"""
dependencies.py — FastAPI dependency chain for auth and request context.

Dependency hierarchy (from outermost to innermost):
  get_authenticated_user()
    └── get_tenant_context()               # adds DB-sourced tenant metadata
          ├── require_workspace_access()   # validates workspace membership
          └── require_platform_admin()     # checks ADMIN_EMAILS allowlist

All dependencies are FastAPI-compatible callables that accept FastAPI's
Request/Header injection.  They raise HTTPException(401) or HTTPException(403)
on failure — never 500.
"""
from __future__ import annotations

import uuid
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.contracts import AuthenticatedUser, RoleKind
from app.auth.supabase import verify_supabase_jwt
from app.auth.tokens import verify_app_token
from app.config import get_settings
from app.database import get_db
from app.models import Tenant, TenantMembership, Workspace


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_bearer(authorization: str) -> str:
    """
    Extract the raw token string from an 'Authorization: Bearer <token>' header.

    Raises HTTP 401 if the header is missing or malformed.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header. Expected: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token is empty.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token


def _is_platform_admin(email: str) -> bool:
    """
    Returns True if the given email is in the ADMIN_EMAILS comma-separated
    env allowlist.  Case-insensitive comparison.
    """
    raw = get_settings().admin_emails
    if not raw:
        return False
    allowed = {e.strip().lower() for e in raw.split(",") if e.strip()}
    return email.lower() in allowed


# ---------------------------------------------------------------------------
# Core dependency: get_authenticated_user
# ---------------------------------------------------------------------------

async def get_authenticated_user(
    authorization: Annotated[str | None, Header()] = None,
    db: Session = Depends(get_db),
) -> AuthenticatedUser:
    """
    Primary auth dependency. Accepts BOTH token types:

    1. Supabase JWT (real users):
       - Signed with supabase_jwt_secret (HS256).
       - Claims: sub (user UUID), email, role="authenticated".
       - We verify locally (no network call) then look up tenant_memberships
         in the DB to resolve tenant_id and our app role.

    2. App JWT (demo / impersonation):
       - Signed with app_jwt_secret (HS256).
       - Claims: sub, email, tenant_id, workspace_id, role, is_demo.
       - We verify locally and trust the embedded claims directly.

    Token-type detection: we attempt Supabase verification first. If that
    fails with a signature error we attempt app-JWT verification.  If both
    fail we raise HTTP 401.

    Returns
    -------
    AuthenticatedUser — a frozen dataclass with the normalised request context.

    Raises
    ------
    HTTP 401 — token invalid, expired, or unrecognised.
    HTTP 403 — token valid but user has no membership in any tenant (real users
               who have not been added to a tenant yet).
    """
    raw_token = _parse_bearer(authorization)

    # --- Attempt 1: Supabase JWT ---
    supabase_payload: dict | None = None
    app_payload: dict | None = None

    try:
        supabase_payload = verify_supabase_jwt(raw_token)
    except jwt.InvalidTokenError:
        # Not a valid Supabase token — try app JWT
        try:
            app_payload = verify_app_token(raw_token)
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is invalid or expired.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # --- Branch: real Supabase user ---
    if supabase_payload is not None:
        supabase_user_id: str = supabase_payload["sub"]
        email: str = supabase_payload.get("email", "")

        # Look up the user's tenant membership. For Phase 1 we pick the first
        # (and typically only) membership. Workspace selection happens separately.
        membership = (
            db.query(TenantMembership)
            .filter(TenantMembership.supabase_user_id == uuid.UUID(supabase_user_id))
            .first()
        )
        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "No tenant membership found for this user. "
                    "Contact your account owner or sign up for a demo."
                ),
            )

        return AuthenticatedUser(
            auth_kind="supabase",
            supabase_user_id=supabase_user_id,
            email=email,
            tenant_id=membership.tenant_id,
            role=membership.role,  # type: ignore[arg-type]
            is_demo=False,
            is_platform_admin=_is_platform_admin(email),
        )

    # --- Branch: app JWT (demo / impersonation) ---
    assert app_payload is not None  # type narrowing
    impersonated_raw = app_payload.get("impersonated_tenant")
    return AuthenticatedUser(
        auth_kind="app_jwt",
        supabase_user_id=app_payload["sub"],
        email=app_payload["email"],
        tenant_id=uuid.UUID(app_payload["tenant_id"]),
        role=app_payload["role"],  # type: ignore[arg-type]
        is_demo=bool(app_payload.get("is_demo", False)),
        is_platform_admin=_is_platform_admin(app_payload["email"]),
        impersonated_tenant_id=uuid.UUID(impersonated_raw) if impersonated_raw else None,
    )


# ---------------------------------------------------------------------------
# Second-tier dependency: get_tenant_context
# ---------------------------------------------------------------------------

async def get_tenant_context(
    user: Annotated[AuthenticatedUser, Depends(get_authenticated_user)],
    db: Annotated[Session, Depends(get_db)],
) -> tuple[AuthenticatedUser, Tenant]:
    """
    Builds on get_authenticated_user and resolves the full Tenant ORM object.

    For impersonating platform admins, resolves the *impersonated* tenant
    instead of their own (which may not exist).

    Returns
    -------
    (AuthenticatedUser, Tenant) tuple.

    Raises
    ------
    HTTP 404 if the tenant row is missing (data integrity error).
    """
    effective_tenant_id = user.impersonated_tenant_id or user.tenant_id
    tenant = db.query(Tenant).filter(Tenant.id == effective_tenant_id).first()
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant {effective_tenant_id} not found.",
        )
    return user, tenant


# ---------------------------------------------------------------------------
# Third-tier dependency: require_workspace_access
# ---------------------------------------------------------------------------

async def require_workspace_access(
    workspace_id: uuid.UUID,
    ctx: Annotated[tuple[AuthenticatedUser, Tenant], Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
) -> tuple[AuthenticatedUser, Tenant, Workspace]:
    """
    Validates that the requested workspace belongs to the tenant in the auth
    context.  Prevents horizontal privilege escalation (user A accessing
    workspace belonging to user B's tenant).

    Parameters
    ----------
    workspace_id : path parameter from the route (e.g. /workspaces/{workspace_id}/...).

    Returns
    -------
    (AuthenticatedUser, Tenant, Workspace) triple.

    Raises
    ------
    HTTP 403 — workspace does not belong to the authenticated tenant.
    HTTP 404 — workspace row does not exist.
    """
    user, tenant = ctx
    effective_tenant_id = user.impersonated_tenant_id or user.tenant_id

    workspace = (
        db.query(Workspace)
        .filter(
            Workspace.id == workspace_id,
            Workspace.tenant_id == effective_tenant_id,
        )
        .first()
    )
    if workspace is None:
        print(f"DEBUG: workspace is None for workspace_id={workspace_id} and tenant_id={effective_tenant_id}")
        # Intentionally return 403 (not 404) to avoid leaking workspace existence.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workspace not found or access denied.",
        )
    return user, tenant, workspace


# ---------------------------------------------------------------------------
# Privileged dependency: require_platform_admin
# ---------------------------------------------------------------------------

async def require_platform_admin(
    user: Annotated[AuthenticatedUser, Depends(get_authenticated_user)],
) -> AuthenticatedUser:
    """
    Hard gate for platform-admin-only endpoints.

    Checks BOTH the is_platform_admin flag (from email allowlist) AND that the
    request came from a real Supabase session (not a demo app-JWT — demo users
    should never have admin access even if their email matches).

    Raises
    ------
    HTTP 403 — caller is not a platform admin or is on a demo session.
    """
    if not user.is_platform_admin or user.is_demo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform administrator access required.",
        )
    return user
