import uuid

from fastapi.testclient import TestClient

from app.models.matching_run import MatchingRun
from app.models.tenant import Tenant
from app.models.workspace import Workspace

STANDARD_WORKSPACE_403 = "Workspace not found or access denied."


def _assert_isolated(response) -> None:
    assert response.status_code == 403
    assert response.json()["detail"] == STANDARD_WORKSPACE_403
    assert "run-1" not in response.text
    assert "test" not in response.text


def test_workspace_isolation_matching(client: TestClient, db_session, seed_tenant_and_user):
    tenant_id = seed_tenant_and_user["tenant_id"]
    auth_headers = seed_tenant_and_user["headers"]

    other_tenant = Tenant(
        id=uuid.uuid4(),
        slug=f"other-{uuid.uuid4().hex[:8]}",
        display_name="Other Tenant",
    )
    db_session.add(other_tenant)
    db_session.flush()

    ws1 = Workspace(tenant_id=tenant_id, name="WS 1", status="draft", source="manual")
    ws2 = Workspace(
        tenant_id=other_tenant.id, name="WS 2", status="draft", source="manual"
    )
    db_session.add_all([ws1, ws2])
    db_session.commit()

    run_ws1 = MatchingRun(
        tenant_id=tenant_id,
        workspace_id=ws1.id,
        run_id="run-1",
        status="completed",
        scope="all_ready_segments",
    )
    db_session.add(run_ws1)
    db_session.commit()

    # Attempt to access run-1 via a workspace in another tenant.
    r1 = client.get(
        f"/api/workspaces/{ws2.id}/matching/runs/run-1/rooms?segment_key=test",
        headers=auth_headers,
    )
    _assert_isolated(r1)

    r2 = client.get(
        f"/api/workspaces/{ws2.id}/matching/runs/run-1/students?segment_key=test",
        headers=auth_headers,
    )
    _assert_isolated(r2)

    r3 = client.get(
        f"/api/workspaces/{ws2.id}/matching/runs/run-1/students/all-segments",
        headers=auth_headers,
    )
    _assert_isolated(r3)

    r4 = client.get(
        f"/api/workspaces/{ws2.id}/fairness/run-1", headers=auth_headers
    )
    _assert_isolated(r4)

    r5 = client.get(
        f"/api/workspaces/{ws2.id}/exports/assignments/run-1", headers=auth_headers
    )
    _assert_isolated(r5)

    # Cross-tenant POST: no run may be created in ws2 and ws1 stays untouched.
    post = client.post(
        f"/api/workspaces/{ws2.id}/matching/runs",
        json={"scope": "all_ready_segments", "segment_key": None},
        headers=auth_headers,
    )
    assert post.status_code == 403
    assert post.json()["detail"] == STANDARD_WORKSPACE_403
    assert db_session.query(MatchingRun).filter_by(workspace_id=ws1.id).count() == 1
    assert db_session.query(MatchingRun).filter_by(workspace_id=ws2.id).count() == 0
