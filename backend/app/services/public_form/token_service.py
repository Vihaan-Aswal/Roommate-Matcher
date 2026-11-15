import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.workspace_form_link import WorkspaceFormLink


def _now() -> datetime:
    return datetime.now(UTC)


def is_expired(link: WorkspaceFormLink, now: datetime | None = None) -> bool:
    moment = now or _now()
    expires_at = link.expires_at
    if expires_at is None:
        return False
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    return expires_at <= moment


def get_active_token(db: Session, workspace_id: uuid.UUID) -> WorkspaceFormLink | None:
    link = db.scalars(
        select(WorkspaceFormLink).where(
            WorkspaceFormLink.workspace_id == workspace_id,
            WorkspaceFormLink.is_active == True,
        )
    ).first()
    if link is None or is_expired(link):
        return None
    return link


def regenerate_token(db: Session, workspace_id: uuid.UUID, tenant_id: uuid.UUID) -> WorkspaceFormLink:
    try:
        existing = db.scalars(
            select(WorkspaceFormLink).where(
                WorkspaceFormLink.workspace_id == workspace_id,
                WorkspaceFormLink.is_active == True,
            )
        ).first()
        if existing is not None:
            existing.is_active = False
            db.add(existing)
            db.flush()

        ttl_days = get_settings().form_link_ttl_days
        new_token = WorkspaceFormLink(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            public_form_token=secrets.token_urlsafe(32),
            is_active=True,
            expires_at=_now() + timedelta(days=ttl_days),
        )
        db.add(new_token)
        db.commit()
        db.refresh(new_token)
        return new_token
    except Exception as e:
        db.rollback()
        raise e
