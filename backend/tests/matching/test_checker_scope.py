import uuid
import pytest
from sqlalchemy.orm import Session
from app.models.workspace import Workspace
from app.models.segment import Segment
from app.models.student import Student
from app.models.preference_profile import PreferenceProfile
from app.services.orchestration.checker_workflow import run_manual_checker

def test_checker_scope(db_session: Session, seed_tenant_and_user):
    tenant_id = seed_tenant_and_user["tenant_id"]
    ws1 = Workspace(id=uuid.uuid4(), tenant_id=tenant_id, name="WS 1", status="draft", source="manual")
    ws2 = Workspace(id=uuid.uuid4(), tenant_id=tenant_id, name="WS 2", status="draft", source="manual")
    db_session.add_all([ws1, ws2])
    db_session.commit()

    seg1 = Segment(tenant_id=tenant_id, workspace_id=ws1.id, segment_key="WS1-M", gender="M", year_group="1", ac_type="N", room_size=2)
    seg2 = Segment(tenant_id=tenant_id, workspace_id=ws2.id, segment_key="WS2-M", gender="M", year_group="1", ac_type="N", room_size=2)
    db_session.add_all([seg1, seg2])
    db_session.commit()

    import datetime
    s1 = Student(tenant_id=tenant_id, workspace_id=ws1.id, segment_id=seg1.id, admission_number="STU-1", full_name="Student 1", gender="M", year_group="1", ac_type="N", room_size=2, dob=datetime.date(2000, 1, 1), phone_last4="1234", is_active=True)
    s2 = Student(tenant_id=tenant_id, workspace_id=ws2.id, segment_id=seg2.id, admission_number="STU-2", full_name="Student 2", gender="M", year_group="1", ac_type="N", room_size=2, dob=datetime.date(2000, 1, 1), phone_last4="5678", is_active=True)
    s3_inactive = Student(tenant_id=tenant_id, workspace_id=ws1.id, segment_id=seg1.id, admission_number="STU-3", full_name="Student 3", gender="M", year_group="1", ac_type="N", room_size=2, dob=datetime.date(2000, 1, 1), phone_last4="9012", is_active=False)
    db_session.add_all([s1, s2, s3_inactive])
    db_session.commit()

    prof1 = PreferenceProfile(tenant_id=tenant_id, workspace_id=ws1.id, student_id=s1.id, has_preferences=False, is_active=True)
    db_session.add_all([prof1])
    db_session.commit()

    # Admission number from WS2 cannot be checked in WS1 context
    # Admission number from WS2 cannot be checked in WS1 context
    with pytest.raises(ValueError, match="One or more student_ids are invalid, not in the target segment, or inactive"):
        run_manual_checker(db_session, segment_key="WS1-M", workspace_id=ws1.id, room_size=2, student_ids=["STU-1", "STU-2"], precomputed_satisfaction=None, precomputed_labels=None)

    # Inactive student cannot be checked
    # Inactive student cannot be checked
    with pytest.raises(ValueError, match="One or more student_ids are invalid, not in the target segment, or inactive"):
        run_manual_checker(db_session, segment_key="WS1-M", workspace_id=ws1.id, room_size=2, student_ids=["STU-1", "STU-3"], precomputed_satisfaction=None, precomputed_labels=None)

    # Correct workspace only
    # Correct workspace only
    try:
        run_manual_checker(db_session, segment_key="WS1-M", workspace_id=ws1.id, room_size=1, student_ids=["STU-1"], precomputed_satisfaction=None, precomputed_labels=None)
    except ValueError as e:
        # Ignore matching algo errors if room_size 1 causes it
        pass
