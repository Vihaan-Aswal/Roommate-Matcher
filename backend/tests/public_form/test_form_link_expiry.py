from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.workspace_form_link import WorkspaceFormLink


def _link(
    db: Session,
    tenant_id: uuid.UUID,
    workspace_id: uuid.UUID,
    *,
    expires_at: datetime,
    active: bool = True,
) -> WorkspaceFormLink:
    link = WorkspaceFormLink(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        public_form_token=f"token-{uuid.uuid4().hex}",
        is_active=active,
        expires_at=expires_at,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


def test_expired_form_link_is_invalid_for_get_and_submit(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    link = _link(
        db_session,
        seed_tenant_and_user["tenant_id"],
        seed_tenant_and_user["workspace_id"],
        expires_at=datetime.now(UTC) - timedelta(minutes=1),
    )

    config = client.get(f"/api/public/forms/{link.public_form_token}")
    assert config.status_code == 200
    assert config.json() == {"token_valid": False}

    submit = client.post(
        f"/api/public/forms/{link.public_form_token}/submit",
        json={
            "submitted_admission_number": "ADM001",
            "submitted_phone_last4": "1234",
            "answers": {},
        },
    )
    assert submit.status_code == 400
    assert submit.json()["detail"] == {"error": "form_link_invalid"}


def test_form_link_response_carries_its_expiry(client: TestClient, seed_tenant_and_user) -> None:
    response = client.get(
        f"/api/workspaces/{seed_tenant_and_user['workspace_id']}/form-link",
        headers=seed_tenant_and_user["headers"],
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token"]
    assert body["expires_at"]
    expires = datetime.fromisoformat(body["expires_at"])
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    assert expires > datetime.now(UTC)


def test_expired_link_is_replaced_on_read(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    old = _link(
        db_session,
        seed_tenant_and_user["tenant_id"],
        seed_tenant_and_user["workspace_id"],
        expires_at=datetime.now(UTC) - timedelta(days=1),
    )

    response = client.get(
        f"/api/workspaces/{seed_tenant_and_user['workspace_id']}/form-link",
        headers=seed_tenant_and_user["headers"],
    )
    assert response.status_code == 200
    new_token = response.json()["token"]
    assert new_token != old.public_form_token

    db_session.refresh(old)
    assert old.is_active is False
    fresh = db_session.query(WorkspaceFormLink).filter_by(public_form_token=new_token).one()
    fresh_expiry = fresh.expires_at
    if fresh_expiry.tzinfo is None:
        fresh_expiry = fresh_expiry.replace(tzinfo=UTC)
    assert fresh_expiry > datetime.now(UTC)
