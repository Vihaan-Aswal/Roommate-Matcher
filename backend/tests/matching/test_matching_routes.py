import uuid
import pytest
from fastapi.testclient import TestClient

def test_matching_routes_unauthenticated(client: TestClient):
    ws_id = uuid.uuid4()
    run_id = "test-run"
    assert client.get(f"/api/workspaces/{ws_id}/matching/runs").status_code == 401
    assert client.post(f"/api/workspaces/{ws_id}/matching/runs", json={"scope": "all_ready_segments", "segment_key": None}).status_code == 401
    assert client.get(f"/api/workspaces/{ws_id}/matching/runs/{run_id}/rooms?segment_key=test").status_code == 401
    assert client.get(f"/api/workspaces/{ws_id}/matching/runs/{run_id}/students?segment_key=test").status_code == 401
    assert client.get(f"/api/workspaces/{ws_id}/matching/runs/{run_id}/students/all-segments").status_code == 401

def test_matching_routes_ownership(client: TestClient, db_session, seed_tenant_and_user):
    tenant_id = seed_tenant_and_user["tenant_id"]
    auth_headers = seed_tenant_and_user["headers"]
    from app.models.workspace import Workspace
    ws1 = Workspace(tenant_id=tenant_id, name="WS 1", status="draft", source="manual")
    ws2 = Workspace(tenant_id=tenant_id, name="WS 2", status="draft", source="manual")
    db_session.add_all([ws1, ws2])
    db_session.commit()

    from app.models.matching_run import MatchingRun
    run_ws1 = MatchingRun(tenant_id=tenant_id, workspace_id=ws1.id, run_id="run-1", status="completed", scope="all_ready_segments")
    db_session.add(run_ws1)
    db_session.commit()

    # GET /matching/runs returns only runs for the requesting workspace
    resp = client.get(f"/api/workspaces/{ws1.id}/matching/runs", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["runs"]) == 1
    assert data["runs"][0]["run_id"] == "run-1"

    resp2 = client.get(f"/api/workspaces/{ws2.id}/matching/runs", headers=auth_headers)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert len(data2["runs"]) == 0

    # GET /matching/runs/{run_id}/rooms returns 403 when run_id belongs to a different workspace
    resp_rooms = client.get(f"/api/workspaces/{ws2.id}/matching/runs/run-1/rooms?segment_key=test", headers=auth_headers)
    assert resp_rooms.status_code == 403
    
    resp_students = client.get(f"/api/workspaces/{ws2.id}/matching/runs/run-1/students?segment_key=test", headers=auth_headers)
    assert resp_students.status_code == 403

    resp_all_students = client.get(f"/api/workspaces/{ws2.id}/matching/runs/run-1/students/all-segments", headers=auth_headers)
    assert resp_all_students.status_code == 403
