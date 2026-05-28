import uuid
import pytest
from sqlalchemy.orm import Session

from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.services.public_form import token_service


@pytest.fixture
def persisted_tenant(db_session: Session) -> Tenant:
    tenant = Tenant(id=uuid.uuid4(), slug=f"test-tenant-{uuid.uuid4().hex[:6]}", display_name="Test Tenant")
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(tenant)
    return tenant


@pytest.fixture
def persisted_workspace(db_session: Session, persisted_tenant: Tenant) -> Workspace:
    workspace = Workspace(
        tenant_id=persisted_tenant.id,
        name="Test Workspace",
        status="draft",
        source="manual",
    )
    db_session.add(workspace)
    db_session.commit()
    db_session.refresh(workspace)
    return workspace


def test_get_active_token_returns_none_if_no_active_token_exists(
    db_session: Session,
    persisted_workspace,
):
    token = token_service.get_active_token(db_session, persisted_workspace.id)
    assert token is None


def test_create_token_returns_new_active_token(
    db_session: Session,
    persisted_workspace,
):
    token = token_service.create_token(db_session, persisted_workspace.id, persisted_workspace.tenant_id)
    assert token is not None
    assert token.is_active is True
    assert token.workspace_id == persisted_workspace.id
    assert token.tenant_id == persisted_workspace.tenant_id
    assert len(token.public_form_token) > 20

    # Ensure it's retrievable
    retrieved = token_service.get_active_token(db_session, persisted_workspace.id)
    assert retrieved is not None
    assert retrieved.id == token.id


def test_create_token_raises_if_active_token_already_exists(
    db_session: Session,
    persisted_workspace,
):
    token_service.create_token(db_session, persisted_workspace.id, persisted_workspace.tenant_id)
    
    with pytest.raises(ValueError, match="An active token already exists"):
        token_service.create_token(db_session, persisted_workspace.id, persisted_workspace.tenant_id)


def test_regenerate_token_deactivates_old_and_creates_new_atomically(
    db_session: Session,
    persisted_workspace,
):
    old_token = token_service.create_token(db_session, persisted_workspace.id, persisted_workspace.tenant_id)
    
    new_token = token_service.regenerate_token(db_session, persisted_workspace.id, persisted_workspace.tenant_id)
    assert new_token is not None
    assert new_token.id != old_token.id
    assert new_token.is_active is True
    assert new_token.public_form_token != old_token.public_form_token
    
    # Reload old token
    db_session.refresh(old_token)
    assert old_token.is_active is False
    
    # get_active_token should return the new one
    active = token_service.get_active_token(db_session, persisted_workspace.id)
    assert active is not None
    assert active.id == new_token.id


def test_tokens_from_different_workspaces_do_not_interfere(
    db_session: Session,
    persisted_workspace,
    persisted_tenant,
):
    from app.models.workspace import Workspace
    workspace2 = Workspace(
        tenant_id=persisted_tenant.id,
        name="Workspace 2",
        status="draft",
        source="manual",
    )
    db_session.add(workspace2)
    db_session.commit()
    db_session.refresh(workspace2)

    token1 = token_service.create_token(db_session, persisted_workspace.id, persisted_workspace.tenant_id)
    token2 = token_service.create_token(db_session, workspace2.id, workspace2.tenant_id)
    
    assert token1.id != token2.id
    
    # Both should be active
    active1 = token_service.get_active_token(db_session, persisted_workspace.id)
    active2 = token_service.get_active_token(db_session, workspace2.id)
    assert active1 is not None and active1.id == token1.id
    assert active2 is not None and active2.id == token2.id
