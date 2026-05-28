import uuid
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.workspace import Workspace
from app.models.tenant import Tenant
from app.models.tenant_membership import TenantMembership
from app.auth.tokens import issue_demo_token

def test_list_workspaces_empty(client: TestClient, seed_tenant_and_user: dict[str, Any]):
    response = client.get("/api/workspaces", headers=seed_tenant_and_user["headers"])
    assert response.status_code == 200
    assert len(response.json()["workspaces"]) == 1
    assert response.json()["workspaces"][0]["name"] == "Test Workspace"

def test_create_workspace(client: TestClient, seed_tenant_and_user: dict[str, Any]):
    response = client.post(
        "/api/workspaces",
        json={"name": "Test Workspace"},
        headers=seed_tenant_and_user["headers"]
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Workspace"
    assert data["status"] == "draft"
    assert data["source"] == "manual"
    assert "id" in data

def test_create_workspace_unauthenticated(client: TestClient):
    response = client.post("/api/workspaces", json={"name": "Test Workspace"})
    assert response.status_code == 401

def test_list_workspaces_after_create(client: TestClient, seed_tenant_and_user: dict[str, Any]):
    client.post("/api/workspaces", json={"name": "WS 1"}, headers=seed_tenant_and_user["headers"])
    client.post("/api/workspaces", json={"name": "WS 2"}, headers=seed_tenant_and_user["headers"])
    
    response = client.get("/api/workspaces", headers=seed_tenant_and_user["headers"])
    assert response.status_code == 200
    data = response.json()
    assert len(data["workspaces"]) == 3
    
    names = [w["name"] for w in data["workspaces"]]
    assert "WS 1" in names
    assert "WS 2" in names
    assert "Test Workspace" in names

def test_get_workspace_by_id(client: TestClient, seed_tenant_and_user: dict[str, Any]):
    create_resp = client.post(
        "/api/workspaces",
        json={"name": "Test WS"},
        headers=seed_tenant_and_user["headers"]
    )
    ws_id = create_resp.json()["id"]
    
    response = client.get(f"/api/workspaces/{ws_id}", headers=seed_tenant_and_user["headers"])
    assert response.status_code == 200
    assert response.json()["name"] == "Test WS"

def test_get_workspace_wrong_tenant(client: TestClient, db_session: Session, seed_tenant_and_user: dict[str, Any]):
    # Create another tenant and workspace
    other_tenant_id = uuid.uuid4()
    tenant = Tenant(id=other_tenant_id, slug="other-tenant", display_name="Other Tenant")
    db_session.add(tenant)
    db_session.flush()
    
    ws = Workspace(
        tenant_id=other_tenant_id,
        name="Other WS",
        status="draft",
        source="manual"
    )
    db_session.add(ws)
    db_session.commit()
    
    response = client.get(f"/api/workspaces/{ws.id}", headers=seed_tenant_and_user["headers"])
    assert response.status_code == 403

def test_workspace_dashboard_empty(client: TestClient, seed_tenant_and_user: dict[str, Any]):
    create_resp = client.post(
        "/api/workspaces",
        json={"name": "Empty Dashboard WS"},
        headers=seed_tenant_and_user["headers"]
    )
    ws_id = create_resp.json()["id"]
    
    response = client.get(f"/api/workspaces/{ws_id}/dashboard", headers=seed_tenant_and_user["headers"])
    assert response.status_code == 200
    data = response.json()
    
    assert data["form_collection_stats"]["total_students"] == 0
    assert data["setup_status"]["master_students_uploaded"] is False
    assert data["latest_matching_run"]["run_id"] is None

def test_create_workspace_name_validation(client: TestClient, seed_tenant_and_user: dict[str, Any]):
    # Should fail if name is empty or missing (Pydantic validation, or just string constraints)
    response = client.post(
        "/api/workspaces",
        json={"wrong_field": "Test"},
        headers=seed_tenant_and_user["headers"]
    )
    assert response.status_code == 422
