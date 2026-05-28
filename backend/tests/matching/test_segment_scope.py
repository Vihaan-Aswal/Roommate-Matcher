import uuid
import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.models.segment import Segment
from app.models.student import Student
from app.services.segments.status import list_segment_overviews, compute_segment_status

def test_segment_status_scope(db_session: Session, seed_tenant_and_user):
    tenant_id = seed_tenant_and_user["tenant_id"]

    ws1 = Workspace(tenant_id=tenant_id, name="WS 1", status="draft", source="manual")
    ws2 = Workspace(tenant_id=tenant_id, name="WS 2", status="draft", source="manual")
    db_session.add_all([ws1, ws2])
    db_session.commit()

    seg1 = Segment(
        tenant_id=tenant_id,
        workspace_id=ws1.id,
        segment_key="WS1-M-1",
        gender="M",
        year_group="Freshman",
        ac_type="Non-AC",
        room_size=2
    )
    seg2 = Segment(
        tenant_id=tenant_id,
        workspace_id=ws2.id,
        segment_key="WS2-F-1",
        gender="F",
        year_group="Freshman",
        ac_type="AC",
        room_size=2
    )
    db_session.add_all([seg1, seg2])
    db_session.commit()

    import datetime
    s1_active = Student(
        tenant_id=tenant_id,
        workspace_id=ws1.id,
        segment_id=seg1.id,
        admission_number="STU-1",
        full_name="Student 1",
        gender="M",
        year_group="Freshman",
        ac_type="Non-AC",
        room_size=2,
        dob=datetime.date(2000, 1, 1),
        phone_last4="1234",
        is_active=True
    )
    s1_inactive = Student(
        tenant_id=tenant_id,
        workspace_id=ws1.id,
        segment_id=seg1.id,
        admission_number="STU-2",
        full_name="Student 2",
        gender="M",
        year_group="Freshman",
        ac_type="Non-AC",
        room_size=2,
        dob=datetime.date(2000, 1, 1),
        phone_last4="5678",
        is_active=False
    )
    db_session.add_all([s1_active, s1_inactive])
    db_session.commit()

    ws1_segs = list_segment_overviews(db_session, ws1.id)
    assert len(ws1_segs) == 1
    assert ws1_segs[0].segment_key == "WS1-M-1"

    ws2_segs = list_segment_overviews(db_session, ws2.id)
    assert len(ws2_segs) == 1
    assert ws2_segs[0].segment_key == "WS2-F-1"

    with pytest.raises(KeyError):
        compute_segment_status(db_session, "WS2-F-1", ws1.id)

    status_ws1 = compute_segment_status(db_session, "WS1-M-1", ws1.id)
    assert status_ws1.student_count == 1

def test_segment_routes_auth(client: TestClient):
    random_uuid = uuid.uuid4()
    resp = client.get(f"/api/workspaces/{random_uuid}/segments")
    assert resp.status_code == 401
