"""Scheduled and boot-time purge of expired demo tenants."""
from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tenant import Tenant


def purge_expired_demo_tenants(
    db: Session, *, now: datetime | None = None, limit: int = 50
) -> list[str]:
    """Delete up to `limit` expired demo tenants, oldest first, and return their IDs."""
    cutoff = now or datetime.now(UTC)
    expired = db.scalars(
        select(Tenant)
        .where(
            Tenant.is_demo.is_(True),
            Tenant.demo_expires_at.isnot(None),
            Tenant.demo_expires_at < cutoff,
        )
        .order_by(Tenant.demo_expires_at)
        .limit(limit)
    ).all()

    purged_ids = [str(tenant.id) for tenant in expired]
    for tenant in expired:
        db.delete(tenant)
    db.commit()
    return purged_ids
