import uuid
import pytest
from fastapi.testclient import TestClient

def test_fairness_checker_exports_scope(client: TestClient, db_session, seed_tenant_and_user):
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

    # Fairness 403
    resp_fairness = client.get(f"/api/workspaces/{ws2.id}/fairness/run-1", headers=auth_headers)
    assert resp_fairness.status_code == 403

    # Exports 403
    resp_exports = client.get(f"/api/workspaces/{ws2.id}/exports/assignments/run-1", headers=auth_headers)
    assert resp_exports.status_code == 403

    # Checker resolves students from correct workspace
    resp_checker = client.post(f"/api/workspaces/{ws1.id}/checker/compatibility", json={
        "segment_key": "test",
        "room_size": 2,
        "student_ids": ["non-existent"]
    }, headers=auth_headers)
    assert resp_checker.status_code == 404
    assert "One or more students not found in this workspace" in resp_checker.json()["detail"]
