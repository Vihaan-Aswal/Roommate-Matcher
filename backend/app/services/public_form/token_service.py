import secrets
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.workspace_form_link import WorkspaceFormLink


def get_active_token(db: Session, workspace_id: uuid.UUID) -> WorkspaceFormLink | None:
    return db.scalars(
        select(WorkspaceFormLink).where(
            WorkspaceFormLink.workspace_id == workspace_id,
            WorkspaceFormLink.is_active == True,
        )
    ).first()



def regenerate_token(db: Session, workspace_id: uuid.UUID, tenant_id: uuid.UUID) -> WorkspaceFormLink:
    try:
        existing = get_active_token(db, workspace_id)
        if existing is not None:
            existing.is_active = False
            db.add(existing)
            db.flush()
        
        new_token = WorkspaceFormLink(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            public_form_token=secrets.token_urlsafe(32),
            is_active=True,
        )
        db.add(new_token)
        db.commit()
        db.refresh(new_token)
        return new_token
    except Exception as e:
        db.rollback()
        raise e
