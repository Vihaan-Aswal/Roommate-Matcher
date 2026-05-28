"""
backend/tests/platform/test_impersonation.py

Tests for Phase 7: Platform Console impersonation.
"""
import uuid
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime, UTC, timedelta
import jwt

from app.config import get_settings
from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.models.platform_audit_event import PlatformAuditEvent

@pytest.fixture(autouse=True)
def setup_platform_env():
    os.environ["ADMIN_EMAILS"] = "admin@platform.com,super@platform.com"
    get_settings.cache_clear()
    yield
    os.environ.pop("ADMIN_EMAILS", None)
    get_settings.cache_clear()


def issue_test_supabase_token(email: str, user_id: str | None = None) -> str:
    secret = get_settings().supabase_jwt_secret
    payload = {
        "sub": user_id or str(uuid.uuid4()),
        "email": email,
        "aud": get_settings().supabase_jwt_audience,
        "iss": get_settings().supabase_jwt_issuer,
        "role": "authenticated",
        "exp": datetime.now(UTC) + timedelta(hours=1)
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def issue_test_demo_token(email: str, tenant_id: str, workspace_id: str) -> str:
    secret = get_settings().app_jwt_secret
    payload = {
        "sub": str(uuid.uuid4()),
        "email": email,
        "tenant_id": tenant_id,
        "workspace_id": workspace_id,
        "role": "owner",
        "is_demo": True,
        "exp": datetime.now(UTC) + timedelta(hours=1)
    }
    return jwt.encode(payload, secret, algorithm="HS256")


from app.models.tenant_membership import TenantMembership

@pytest.fixture
def platform_admin_token(db_session: Session) -> str:
    admin_id = uuid.uuid4()
    admin_email = "admin@platform.com"
    
    tenant_id = uuid.uuid4()
    tenant = Tenant(id=tenant_id, slug="admin-home-tenant", display_name="Admin Home", is_demo=False)
    db_session.add(tenant)
    db_session.flush()
    
    membership = TenantMembership(
        tenant_id=tenant_id,
        supabase_user_id=admin_id,
        email=admin_email,
        role="owner"
    )
    db_session.add(membership)
    db_session.commit()
    
    return issue_test_supabase_token(admin_email, str(admin_id))


@pytest.fixture
def non_admin_token() -> str:
    return issue_test_supabase_token("user@example.com")


@pytest.fixture
def seeded_tenant_and_workspace(db_session: Session):
    tenant_id = uuid.uuid4()
    workspace_id = uuid.uuid4()
    
    tenant = Tenant(id=tenant_id, slug="real-tenant", display_name="Real Tenant", is_demo=False)
    db_session.add(tenant)
    db_session.flush()

    workspace = Workspace(id=workspace_id, tenant_id=tenant_id, name="Real Workspace")
    db_session.add(workspace)
    db_session.commit()
    
    return {"tenant_id": str(tenant_id), "workspace_id": str(workspace_id), "tenant": tenant, "workspace": workspace}


@pytest.fixture
def seeded_demo_tenant(db_session: Session):
    tenant_id = uuid.uuid4()
    tenant = Tenant(id=tenant_id, slug="demo-tenant", display_name="Demo Tenant", is_demo=True)
    db_session.add(tenant)
    db_session.commit()
    return {"tenant_id": str(tenant_id), "tenant": tenant}


def test_require_platform_admin_blocks_non_admin(client: TestClient, non_admin_token: str):
    res = client.get(
        "/api/platform/tenants",
        headers={"Authorization": f"Bearer {non_admin_token}"}
    )
    assert res.status_code == 403


def test_require_platform_admin_blocks_demo_session(client: TestClient, seeded_tenant_and_workspace):
    demo_token = issue_test_demo_token(
        "admin@platform.com", 
        seeded_tenant_and_workspace["tenant_id"], 
        seeded_tenant_and_workspace["workspace_id"]
    )
    res = client.get(
        "/api/platform/tenants",
        headers={"Authorization": f"Bearer {demo_token}"}
    )
    assert res.status_code == 403


def test_platform_admin_can_list_tenants(client: TestClient, platform_admin_token: str, seeded_tenant_and_workspace, seeded_demo_tenant):
    res = client.get(
        "/api/platform/tenants",
        headers={"Authorization": f"Bearer {platform_admin_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["tenants"]) == 2
    tenant_ids = [t["id"] for t in data["tenants"]]
    assert seeded_tenant_and_workspace["tenant_id"] in tenant_ids


def test_platform_admin_list_includes_demo_when_requested(client: TestClient, platform_admin_token: str, seeded_tenant_and_workspace, seeded_demo_tenant):
    res = client.get(
        "/api/platform/tenants?include_demo=true",
        headers={"Authorization": f"Bearer {platform_admin_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["tenants"]) == 3


def test_platform_admin_can_list_tenant_workspaces(client: TestClient, platform_admin_token: str, seeded_tenant_and_workspace):
    tenant_id = seeded_tenant_and_workspace["tenant_id"]
    res = client.get(
        f"/api/platform/tenants/{tenant_id}/workspaces",
        headers={"Authorization": f"Bearer {platform_admin_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["workspaces"]) == 1
    assert data["workspaces"][0]["id"] == seeded_tenant_and_workspace["workspace_id"]


def test_impersonation_issues_token_and_writes_audit_event(
    client: TestClient, 
    platform_admin_token: str, 
    seeded_tenant_and_workspace, 
    db_session: Session
):
    tenant_id = seeded_tenant_and_workspace["tenant_id"]
    workspace_id = seeded_tenant_and_workspace["workspace_id"]
    
    res = client.post(
        f"/api/platform/tenants/{tenant_id}/impersonate",
        headers={"Authorization": f"Bearer {platform_admin_token}"},
        json={"workspace_id": workspace_id}
    )
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    assert data["tenant_id"] == tenant_id
    assert data["workspace_id"] == workspace_id
    
    # Check audit log
    audit_events = db_session.query(PlatformAuditEvent).all()
    assert len(audit_events) == 1
    assert str(audit_events[0].tenant_id) == tenant_id
    assert str(audit_events[0].workspace_id) == workspace_id
    assert audit_events[0].event_type == "platform_admin.impersonate"


def test_impersonation_wrong_workspace_returns_404(
    client: TestClient, 
    platform_admin_token: str, 
    seeded_tenant_and_workspace
):
    tenant_id = seeded_tenant_and_workspace["tenant_id"]
    wrong_workspace_id = str(uuid.uuid4())
    
    res = client.post(
        f"/api/platform/tenants/{tenant_id}/impersonate",
        headers={"Authorization": f"Bearer {platform_admin_token}"},
        json={"workspace_id": wrong_workspace_id}
    )
    assert res.status_code == 404


def test_impersonation_token_grants_workspace_access(
    client: TestClient, 
    platform_admin_token: str, 
    seeded_tenant_and_workspace
):
    tenant_id = seeded_tenant_and_workspace["tenant_id"]
    workspace_id = seeded_tenant_and_workspace["workspace_id"]
    
    res = client.post(
        f"/api/platform/tenants/{tenant_id}/impersonate",
        headers={"Authorization": f"Bearer {platform_admin_token}"},
        json={"workspace_id": workspace_id}
    )
    assert res.status_code == 200
    impersonation_token = res.json()["token"]
    
    dash_res = client.get(
        f"/api/workspaces/{workspace_id}/dashboard",
        headers={"Authorization": f"Bearer {impersonation_token}"}
    )
    assert dash_res.status_code == 200
