import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.models.workspace import Workspace
from app.models.segment import Segment
from app.models.matching_run import MatchingRun
from app.models.room_assignment import RoomAssignment
from app.main import app

def test_exports_scoping(db_session: Session, client: TestClient, seed_tenant_and_user):
    tenant_id = seed_tenant_and_user["tenant_id"]
    headers = seed_tenant_and_user["headers"]

    import uuid
    ws1 = Workspace(id=uuid.uuid4(), tenant_id=tenant_id, name="WS 1", status="draft", source="manual")
    ws2 = Workspace(id=uuid.uuid4(), tenant_id=tenant_id, name="WS 2", status="draft", source="manual")
    db_session.add_all([ws1, ws2])
    db_session.commit()

    seg1 = Segment(
        tenant_id=tenant_id, workspace_id=ws1.id, segment_key="WS1-M-1",
        gender="M", year_group="Freshman", ac_type="Non-AC", room_size=2
    )
    seg2 = Segment(
        tenant_id=tenant_id, workspace_id=ws2.id, segment_key="WS1-M-1",
        gender="M", year_group="Freshman", ac_type="Non-AC", room_size=2
    )
    db_session.add_all([seg1, seg2])
    db_session.commit()

    import datetime
    run1 = MatchingRun(
        tenant_id=tenant_id, workspace_id=ws1.id, run_id="run_1",
        scope="segment", target_segment_id=seg1.id, status="completed"
    )
    db_session.add(run1)
    db_session.commit()

    ra1 = RoomAssignment(
        tenant_id=tenant_id, workspace_id=ws1.id, matching_run_id=run1.id,
        segment_id=seg1.id, room_id="R1", group_score=0.9, assigned_students_json='["STU-1", "STU-2"]'
    )
    db_session.add(ra1)
    db_session.commit()

    # Valid export in ws1
    response = client.get(f"/api/workspaces/{ws1.id}/exports/assignments/run_1", headers=headers)
    assert response.status_code == 200

    # Invalid export crossing workspaces (ws2 tries to get run_1)
    response = client.get(f"/api/workspaces/{ws2.id}/exports/assignments/run_1", headers=headers)
    assert response.status_code == 403
