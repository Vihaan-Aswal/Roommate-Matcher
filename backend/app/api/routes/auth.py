"""
auth.py — authentication endpoints.

POST /api/auth/session
    Accepts a Supabase access_token from the frontend (after the user signs in
    via the Supabase JS client).  Validates the token, finds or creates the
    TenantMembership row (future: Phase 2 handles first-login workspace creation),
    and returns session metadata.

POST /api/auth/demo
    Creates a throwaway demo tenant + workspace, seeds it with sample data
    (Phase 6 adds full seeding; here we create the scaffolding only), and
    returns a short-lived app JWT.

POST /api/auth/logout
    Stateless — the real logout happens client-side (Supabase JS client
    signOut() + clear sessionStorage).  This endpoint exists so the frontend
    can call it for server-side audit logging in the future.

GET /api/auth/me
    Returns the normalised request context for the currently authenticated
    user.  Used by the frontend AuthProvider on mount to re-hydrate state.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.auth.contracts import AuthenticatedUser
from app.auth.dependencies import get_authenticated_user
from app.auth.supabase import verify_supabase_jwt
from app.auth.tokens import issue_demo_token
from app.config import get_settings
from app.database import get_db
from app.models import Tenant, TenantMembership, Workspace

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Pydantic schemas (request / response bodies for this router only)
# ---------------------------------------------------------------------------

class SessionRequest(BaseModel):
    access_token: str


class SessionResponse(BaseModel):
    supabase_user_id: str
    email: str
    tenant_id: str
    role: str
    is_platform_admin: bool


class DemoRequest(BaseModel):
    email: str   # used for display only; no verification


class DemoResponse(BaseModel):
    token: str           # short-lived app JWT
    tenant_id: str
    workspace_id: str
    expires_at: str      # ISO-8601 UTC string


class MeResponse(BaseModel):
    auth_kind: str
    supabase_user_id: str
    email: str
    tenant_id: str
    role: str
    is_demo: bool
    is_platform_admin: bool
    impersonated_tenant_id: str | None


# ---------------------------------------------------------------------------
# POST /api/auth/session
# ---------------------------------------------------------------------------

@router.post("/session", response_model=SessionResponse)
async def exchange_session(
    body: SessionRequest,
    db: Annotated[Session, Depends(get_db)],
) -> SessionResponse:
    """
    Called by the frontend immediately after a successful Supabase sign-in.

    Flow:
    1. Verify the Supabase JWT (raises 401 on failure).
    2. Look up the TenantMembership row.
    3. If no membership exists, raise 403 — the user must be invited first
       (Phase 2 will add an invite flow; for Phase 1 create memberships manually
       via Supabase dashboard or a seed script).
    4. Return session metadata so the frontend can set up the AuthContext.
    """
    try:
        claims = verify_supabase_jwt(body.access_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Supabase token.",
        )

    supabase_user_id = claims["sub"]
    email = claims.get("email", "")

    membership = (
        db.query(TenantMembership)
        .filter(TenantMembership.supabase_user_id == uuid.UUID(supabase_user_id))
        .first()
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenant membership found. Contact your account owner.",
        )

    settings = get_settings()
    admin_set = {e.strip().lower() for e in (settings.admin_emails or "").split(",") if e.strip()}
    is_admin = email.lower() in admin_set

    return SessionResponse(
        supabase_user_id=supabase_user_id,
        email=email,
        tenant_id=str(membership.tenant_id),
        role=membership.role,
        is_platform_admin=is_admin,
    )


# ---------------------------------------------------------------------------
# POST /api/auth/demo
# ---------------------------------------------------------------------------

@router.post("/demo", response_model=DemoResponse)
async def create_demo_session(
    body: DemoRequest,
    db: Annotated[Session, Depends(get_db)],
) -> DemoResponse:
    """
    Creates an isolated demo sandbox and returns a short-lived app JWT.

    Phase 1 implementation:
    - Creates a Tenant row with is_demo=True and demo_expires_at=now+24h.
    - Creates a Workspace row with is_demo_seeded=False.
      (Phase 6 adds full data seeding here.)
    - Writes a TenantMembership row so the demo session looks like a real
      owner membership if any code path queries it.
    - Issues a demo app JWT via tokens.issue_demo_token().

    NOTE: No matching data is seeded in Phase 1.  The demo workspace is empty.
    The demo seeder service (Phase 6) will populate it with students + rooms
    + form responses.
    """
    settings = get_settings()
    now = datetime.now(UTC)
    ttl_hours = settings.demo_ttl_hours
    demo_expires_at = now + timedelta(hours=ttl_hours)

    # Create demo Tenant
    slug = f"demo-{secrets.token_hex(6)}"   # e.g. "demo-a1b2c3"
    tenant = Tenant(
        slug=slug,
        display_name="Demo Workspace",
        contact_email=body.email,
        is_demo=True,
        demo_expires_at=demo_expires_at,
    )
    db.add(tenant)
    db.flush()  # get tenant.id without committing

    # Create demo Workspace
    workspace = Workspace(
        tenant_id=tenant.id,
        name="Demo — Spring 2025",
        status="draft",
        source="demo_seed",
        is_demo_seeded=False,  # Phase 6 sets this to True after seeding
    )
    db.add(workspace)
    db.flush()  # get workspace.id

    # Create TenantMembership (placeholder sub for demo)
    membership = TenantMembership(
        tenant_id=tenant.id,
        supabase_user_id=uuid.uuid4(),  # placeholder — demo users are not in Supabase auth
        email=body.email,
        role="owner",
    )
    db.add(membership)
    db.commit()

    # Issue demo app JWT
    token = issue_demo_token(
        tenant_id=tenant.id,
        workspace_id=workspace.id,
        email=body.email,
    )

    return DemoResponse(
        token=token,
        tenant_id=str(tenant.id),
        workspace_id=str(workspace.id),
        expires_at=demo_expires_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# POST /api/auth/logout
# ---------------------------------------------------------------------------

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    user: Annotated[AuthenticatedUser, Depends(get_authenticated_user)],
) -> None:
    """
    Server-side logout hook.  Currently a no-op — real logout state is managed
    client-side (Supabase JS client signOut() + clearing sessionStorage).

    Future use: write a PlatformAuditEvent for session termination, invalidate
    any server-side session state if added in later phases.
    """
    return None


# ---------------------------------------------------------------------------
# GET /api/auth/me
# ---------------------------------------------------------------------------

@router.get("/me", response_model=MeResponse)
async def get_me(
    user: Annotated[AuthenticatedUser, Depends(get_authenticated_user)],
) -> MeResponse:
    """
    Returns the normalised auth context for the calling user.

    Used by the frontend AuthProvider.onMount() to re-hydrate the auth state
    from a stored token without going through the full sign-in flow again.
    """
    return MeResponse(
        auth_kind=user.auth_kind,
        supabase_user_id=user.supabase_user_id,
        email=user.email,
        tenant_id=str(user.tenant_id),
        role=user.role,
        is_demo=user.is_demo,
        is_platform_admin=user.is_platform_admin,
        impersonated_tenant_id=(
            str(user.impersonated_tenant_id) if user.impersonated_tenant_id else None
        ),
    )
