"""
tokens.py — issue and verify backend-signed app JWTs.

App JWTs are used for:
  1. Demo sessions  (POST /api/auth/demo returns one)
  2. Platform-admin impersonation  (Phase 7)

They are short-lived HS256 tokens signed with APP_JWT_SECRET.
The frontend stores them in sessionStorage (not localStorage) so they
are cleared when the browser tab closes.

Claim schema
------------
sub                  : str  — a stable placeholder like "demo:<tenant_id>"
                               or "impersonate:<supabase_user_id>"
email                : str  — actor email
tenant_id            : str  — UUID of the tenant this session is scoped to
workspace_id         : str  — UUID of the initial workspace
role                 : str  — "owner" | "admin" | "viewer"
is_demo              : bool
impersonated_tenant  : str | None  — set only for impersonation tokens (Phase 7)
iat                  : int  — issued-at (set automatically by PyJWT)
exp                  : int  — expiry timestamp
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from app.config import get_settings


_ALGORITHM = "HS256"


def _secret() -> str:
    secret = get_settings().app_jwt_secret
    if not secret:
        raise RuntimeError(
            "APP_JWT_SECRET is not set. "
            "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
        )
    return secret


def issue_demo_token(
    *,
    tenant_id: uuid.UUID,
    workspace_id: uuid.UUID,
    email: str,
    ttl_hours: int | None = None,
) -> str:
    """
    Issue a short-lived app JWT for a demo session.

    Parameters
    ----------
    tenant_id    : UUID of the freshly-created demo tenant.
    workspace_id : UUID of the freshly-created demo workspace.
    email        : The demo user's email (used for display only, not verified).
    ttl_hours    : Lifetime in hours.  Defaults to settings.demo_ttl_hours (24).

    Returns
    -------
    A signed JWT string ready to be returned to the frontend.
    """
    settings = get_settings()
    ttl = ttl_hours if ttl_hours is not None else settings.demo_ttl_hours
    now = datetime.now(UTC)

    payload: dict[str, Any] = {
        "sub": f"demo:{tenant_id}",
        "email": email,
        "tenant_id": str(tenant_id),
        "workspace_id": str(workspace_id),
        "role": "owner",
        "is_demo": True,
        "iat": now,
        "exp": now + timedelta(hours=ttl),
    }
    return jwt.encode(payload, _secret(), algorithm=_ALGORITHM)


def verify_app_token(token: str) -> dict[str, Any]:
    """
    Decode and verify a backend-issued app JWT.

    Returns the decoded payload dict on success.
    Raises jwt.InvalidTokenError (or a subclass) on any failure.

    The caller (get_authenticated_user) catches these and raises HTTP 401.
    """
    payload: dict[str, Any] = jwt.decode(
        token,
        _secret(),
        algorithms=[_ALGORITHM],
        options={"require": ["sub", "email", "tenant_id", "workspace_id", "role", "exp"]},
    )
    return payload
