"""
internal.py — Machine-to-machine internal API routes.

These routes are NOT protected by Supabase JWT. They are protected by a
shared secret (CLEANUP_JOB_SECRET) in the Authorization header. They must
never be called from the frontend and must not appear in the public OpenAPI
docs (include_in_schema=False on the router).

Route prefix: /api/internal
"""
from __future__ import annotations

from datetime import datetime, UTC

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.tenant import Tenant

router = APIRouter(prefix="/api/internal", tags=["internal"], include_in_schema=False)

_bearer = HTTPBearer(auto_error=False)


def _require_cleanup_secret(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> None:
    """
    Validates the shared CLEANUP_JOB_SECRET.
    Raises 401 if the header is absent or the token does not match.
    Raises 503 if CLEANUP_JOB_SECRET is not configured on this instance.
    """
    secret = get_settings().cleanup_job_secret
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cleanup endpoint is not configured on this instance.",
        )
    if credentials is None or credentials.credentials != secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing cleanup job secret.",
        )


class CleanupResult(BaseModel):
    purged_count: int
    purged_tenant_ids: list[str]
    ran_at: str


@router.post(
    "/cleanup/demo-tenants",
    response_model=CleanupResult,
    summary="Purge expired demo tenants",
)
def cleanup_demo_tenants(
    _: None = Depends(_require_cleanup_secret),
    db: Session = Depends(get_db),
) -> CleanupResult:
    """
    Deletes all demo tenants whose demo_expires_at timestamp is in the past.

    Called by the GitHub Actions cron job (.github/workflows/demo-cleanup.yml).
    Protected by CLEANUP_JOB_SECRET — not a user-facing endpoint.

    The Tenant model has relationships to Workspace and TenantMembership.
    Ensure your Postgres FK constraints use ON DELETE CASCADE, or add explicit
    child-row deletion here before deleting the tenant.
    """
    now = datetime.now(UTC)

    expired: list[Tenant] = (
        db.query(Tenant)
        .filter(
            Tenant.is_demo.is_(True),
            Tenant.demo_expires_at.isnot(None),
            Tenant.demo_expires_at < now,
        )
        .all()
    )

    purged_ids: list[str] = []
    for tenant in expired:
        purged_ids.append(str(tenant.id))
        db.delete(tenant)

    db.commit()

    return CleanupResult(
        purged_count=len(purged_ids),
        purged_tenant_ids=purged_ids,
        ran_at=now.isoformat(),
    )
