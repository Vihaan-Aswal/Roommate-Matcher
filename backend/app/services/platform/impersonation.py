"""
impersonation.py — Platform-admin impersonation service.

Responsibilities:
1. Validate the impersonation request parameters.
2. Issue a short-lived app JWT scoped to the impersonated tenant + workspace.
3. Write an audit row to platform_audit_events (every call, no exceptions).

Called by POST /api/platform/tenants/{tenant_id}/impersonate.
The route layer MUST apply require_platform_admin() before calling any function here.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Tenant, Workspace
from app.models.platform_audit_event import PlatformAuditEvent

_ALGORITHM = "HS256"
_IMPERSONATION_TTL_HOURS = 4   # short-lived; non-configurable for now


def _secret() -> str:
    secret = get_settings().app_jwt_secret
    if not secret:
        raise RuntimeError("APP_JWT_SECRET is not set.")
    return secret


def issue_impersonation_token(
    *,
    admin_email: str,
    admin_supabase_user_id: str,
    tenant: Tenant,
    workspace: Workspace,
    db: Session,
) -> str:
    """
    Issue a short-lived HS256 app JWT for platform-admin impersonation.

    Parameters
    ----------
    admin_email             : Email of the platform admin (from AuthenticatedUser).
    admin_supabase_user_id  : Supabase user ID of the admin.
    tenant                  : The Tenant ORM object being impersonated.
    workspace               : The Workspace ORM object selected for impersonation.
    db                      : SQLAlchemy session for audit write.

    Returns
    -------
    Signed JWT string.

    Side Effects
    ------------
    Writes one row to platform_audit_events before returning.
    """
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": f"impersonate:{admin_supabase_user_id}",
        "email": admin_email,
        "tenant_id": str(tenant.id),
        "workspace_id": str(workspace.id),
        "role": "owner",           # impersonating admin gets owner-level view
        "is_demo": False,
        "impersonated_tenant": str(tenant.id),   # triggers impersonation path in get_authenticated_user
        "iat": now,
        "exp": now + timedelta(hours=_IMPERSONATION_TTL_HOURS),
    }
    token = jwt.encode(payload, _secret(), algorithm=_ALGORITHM)

    # Audit log — mandatory, no exceptions
    _write_audit_event(
        db=db,
        event_type="platform_admin.impersonate",
        admin_email=admin_email,
        admin_supabase_user_id=admin_supabase_user_id,
        tenant=tenant,
        workspace=workspace,
    )

    return token


def _write_audit_event(
    *,
    db: Session,
    event_type: str,
    admin_email: str,
    admin_supabase_user_id: str,
    tenant: Tenant,
    workspace: Workspace | None = None,
) -> None:
    """
    Write one row to platform_audit_events.
    Committed immediately as part of the caller's transaction.
    """
    event = PlatformAuditEvent(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        workspace_id=workspace.id if workspace else None,
        actor_supabase_user_id=uuid.UUID(admin_supabase_user_id),
        actor_email=admin_email,
        event_type=event_type,
        payload_json={
            "tenant_slug": tenant.slug,
            "tenant_display_name": tenant.display_name,
            "workspace_id": str(workspace.id) if workspace else None,
            "workspace_name": workspace.name if workspace else None,
            "impersonation_ttl_hours": _IMPERSONATION_TTL_HOURS,
        },
    )
    db.add(event)
    db.commit()
    db.refresh(event)
