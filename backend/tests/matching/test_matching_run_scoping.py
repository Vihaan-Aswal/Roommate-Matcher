import uuid
import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.models.workspace import Workspace
from app.models.segment import Segment
from app.models.student import Student
from app.models.room import Room
from app.models.matching_run import MatchingRun
from app.services.orchestration.run_workflow import run_matching_workflow

def test_matching_run_scoping(db_session: Session, seed_tenant_and_user):
    tenant_id = seed_tenant_and_user["tenant_id"]

    ws1 = Workspace(id=uuid.uuid4(), tenant_id=tenant_id, name="WS 1", status="draft", source="manual")
    ws2 = Workspace(id=uuid.uuid4(), tenant_id=tenant_id, name="WS 2", status="draft", source="manual")
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
        segment_key="WS1-M-1",  # Same key, different workspace
        gender="M",
        year_group="Freshman",
        ac_type="Non-AC",
        room_size=2
    )
    db_session.add_all([seg1, seg2])
    db_session.commit()

    import datetime
    s1_ws1 = Student(
        tenant_id=tenant_id, workspace_id=ws1.id, segment_id=seg1.id,
        admission_number="STU-1", full_name="Student 1", gender="M",
        year_group="Freshman", ac_type="Non-AC", room_size=2, dob=datetime.date(2000, 1, 1),
        phone_last4="1234", is_active=True
    )
    s2_ws1 = Student(
        tenant_id=tenant_id, workspace_id=ws1.id, segment_id=seg1.id,
        admission_number="STU-2", full_name="Student 2", gender="M",
        year_group="Freshman", ac_type="Non-AC", room_size=2, dob=datetime.date(2000, 1, 1),
        phone_last4="1234", is_active=True
    )
    s1_ws2 = Student(
        tenant_id=tenant_id, workspace_id=ws2.id, segment_id=seg2.id,
        admission_number="STU-3", full_name="Student 3", gender="M",
        year_group="Freshman", ac_type="Non-AC", room_size=2, dob=datetime.date(2000, 1, 1),
        phone_last4="1234", is_active=True
    )
    s2_ws2 = Student(
        tenant_id=tenant_id, workspace_id=ws2.id, segment_id=seg2.id,
        admission_number="STU-4", full_name="Student 4", gender="M",
        year_group="Freshman", ac_type="Non-AC", room_size=2, dob=datetime.date(2000, 1, 1),
        phone_last4="1234", is_active=True
    )
    db_session.add_all([s1_ws1, s2_ws1, s1_ws2, s2_ws2])
    
    r1_ws1 = Room(tenant_id=tenant_id, workspace_id=ws1.id, segment_id=seg1.id, room_id="R1", capacity=2, source="uploaded")
    r1_ws2 = Room(tenant_id=tenant_id, workspace_id=ws2.id, segment_id=seg2.id, room_id="R1", capacity=2, source="uploaded")
    db_session.add_all([r1_ws1, r1_ws2])
    db_session.flush()

    from app.models.preference_profile import PreferenceProfile
    pp1 = PreferenceProfile(tenant_id=tenant_id, workspace_id=ws1.id, student_id=s1_ws1.id, is_active=True, has_preferences=True)
    pp2 = PreferenceProfile(tenant_id=tenant_id, workspace_id=ws1.id, student_id=s2_ws1.id, is_active=True, has_preferences=True)
    db_session.add_all([pp1, pp2])
    db_session.commit()

    result = run_matching_workflow(db_session, ws1.id, tenant_id, "segment", "WS1-M-1")
    assert result.status == "completed"

    run_obj = db_session.query(MatchingRun).filter(MatchingRun.run_id == result.run_id).first()
    assert run_obj.workspace_id == ws1.id

    with pytest.raises(ValueError):
        run_matching_workflow(db_session, uuid.uuid4(), tenant_id, "segment", "WS1-M-1")
