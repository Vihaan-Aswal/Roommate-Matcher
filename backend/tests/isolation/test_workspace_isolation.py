import uuid
import pytest
from fastapi.testclient import TestClient

def test_workspace_isolation_matching(client: TestClient, db_session, seed_tenant_and_user):
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

    # Attempt to access run-1 via workspace 2
    r1 = client.get(f"/api/workspaces/{ws2.id}/matching/runs/run-1/rooms?segment_key=test", headers=auth_headers)
    assert r1.status_code == 403

    r2 = client.get(f"/api/workspaces/{ws2.id}/matching/runs/run-1/students?segment_key=test", headers=auth_headers)
    assert r2.status_code == 403

    r3 = client.get(f"/api/workspaces/{ws2.id}/matching/runs/run-1/students/all-segments", headers=auth_headers)
    assert r3.status_code == 403

    r4 = client.get(f"/api/workspaces/{ws2.id}/fairness/run-1", headers=auth_headers)
    assert r4.status_code == 403

    r5 = client.get(f"/api/workspaces/{ws2.id}/exports/assignments/run-1", headers=auth_headers)
    assert r5.status_code == 403
