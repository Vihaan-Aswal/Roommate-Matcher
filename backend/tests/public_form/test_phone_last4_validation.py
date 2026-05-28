import uuid
from datetime import datetime, timezone
import pytest
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.models.workspace_form_link import WorkspaceFormLink
from app.models.student import Student
from app.models.segment import Segment
from app.models.form_response import FormResponse
from app.models.preference_profile import PreferenceProfile

@pytest.fixture
def test_setup(db_session: Session):
    tenant = Tenant(id=uuid.uuid4(), slug=f"t-{uuid.uuid4().hex[:6]}", display_name="T")
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(tenant)

    workspace = Workspace(tenant_id=tenant.id, name="W", status="draft", source="manual")
    db_session.add(workspace)
    db_session.commit()
    db_session.refresh(workspace)

    segment = Segment(tenant_id=tenant.id, workspace_id=workspace.id, segment_key="TEST", gender="M", year_group="Y1", ac_type="AC", room_size=2)
    db_session.add(segment)
    db_session.commit()
    db_session.refresh(segment)

    token = WorkspaceFormLink(tenant_id=tenant.id, workspace_id=workspace.id, public_form_token="VALID_TOKEN", is_active=True)
    db_session.add(token)
    db_session.commit()
    db_session.refresh(token)

    student = Student(
        tenant_id=tenant.id,
        workspace_id=workspace.id,
        segment_id=segment.id,
        admission_number="ADM001",
        full_name="John Doe",
        gender="M",
        year_group="Y1",
        ac_type="AC",
        room_size=2,
        dob=datetime(2000, 1, 1).date(),
        phone_number="1234567890",
        phone_last4="7890",
        is_active=True,
    )
    db_session.add(student)
    db_session.commit()
    db_session.refresh(student)

    return {"tenant": tenant, "workspace": workspace, "token": token, "student": student}

def test_valid_student_correct_phone_last4_persisted_profile_created_valid_true(client, test_setup, db_session):
    student = test_setup["student"]
    resp = client.post(
        "/api/public/forms/VALID_TOKEN/submit",
        json={
            "submitted_admission_number": student.admission_number,
            "submitted_phone_last4": student.phone_last4,
            "answers": {
                "q1_raw": "Before 11 PM (early)", "q2_raw": "Very tidy - I like things clean and organized",
                "q3_raw": "Before 10 PM", "q4a_raw": "Mainly for sleeping/studying, not for hanging out",
                "q4b_raw": "Very uncomfortable", "q5a_raw": "Almost never",
                "q5b_raw": "Very uncomfortable", "q6_raw": "I need a 100% smoke-free room",
                "q7_raw": "I require an alcohol-free room", "q8_raw": "I am strict vegetarian and require a meat-free room",
                "q9_raw": "Budget-conscious - prefer to keep costs low", "q10_raw": "I prefer someone very similar to me"
            }
        }
    )
    assert resp.status_code == 200
    assert resp.json() == {"status": "submitted", "valid": True}

    fr = db_session.scalars(select(FormResponse)).first()
    assert fr.student_id == student.id
    assert fr.validation_status == "valid"

    prof = db_session.scalars(select(PreferenceProfile)).first()
    assert prof.student_id == student.id
    assert prof.is_generated is False
    assert prof.is_active is True

def test_valid_student_wrong_phone_last4_persisted_student_id_set_valid_false(client, test_setup, db_session):
    student = test_setup["student"]
    resp = client.post(
        "/api/public/forms/VALID_TOKEN/submit",
        json={
            "submitted_admission_number": student.admission_number,
            "submitted_phone_last4": "0000",
            "answers": {}
        }
    )
    assert resp.status_code == 200
    assert resp.json() == {"status": "recorded", "valid": False, "error": "phone_mismatch"}

    fr = db_session.scalars(select(FormResponse)).first()
    assert fr.student_id == student.id
    assert fr.validation_status == "invalid"
    assert fr.invalid_reason == "phone_mismatch"

def test_unknown_admission_number_persisted_student_id_null_valid_false(client, test_setup, db_session):
    resp = client.post(
        "/api/public/forms/VALID_TOKEN/submit",
        json={
            "submitted_admission_number": "UNKNOWN999",
            "submitted_phone_last4": "1234",
            "answers": {}
        }
    )
    assert resp.status_code == 200
    assert resp.json() == {"status": "recorded", "valid": False, "error": "student_not_found"}

    fr = db_session.scalars(select(FormResponse)).first()
    assert fr.student_id is None
    assert fr.validation_status == "invalid"
    assert fr.invalid_reason == "student_not_found"

def test_inactive_token_returns_400_nothing_persisted(client, test_setup, db_session):
    token = test_setup["token"]
    token.is_active = False
    db_session.add(token)
    db_session.commit()

    resp = client.post(
        "/api/public/forms/VALID_TOKEN/submit",
        json={
            "submitted_admission_number": "ADM001",
            "submitted_phone_last4": "7890",
            "answers": {}
        }
    )
    assert resp.status_code == 400
    
    count = db_session.query(FormResponse).count()
    assert count == 0

def test_inactive_student_behaves_as_student_not_found(client, test_setup, db_session):
    student = test_setup["student"]
    student.is_active = False
    db_session.add(student)
    db_session.commit()

    resp = client.post(
        "/api/public/forms/VALID_TOKEN/submit",
        json={
            "submitted_admission_number": student.admission_number,
            "submitted_phone_last4": student.phone_last4,
            "answers": {}
        }
    )
    assert resp.status_code == 200
    assert resp.json()["error"] == "student_not_found"

def test_resubmission_by_same_student_updates_preference_profile(client, test_setup, db_session):
    student = test_setup["student"]
    answers = {
        "q1_raw": "Before 11 PM (early)", "q2_raw": "Very tidy - I like things clean and organized",
        "q3_raw": "Before 10 PM", "q4a_raw": "Mainly for sleeping/studying, not for hanging out",
        "q4b_raw": "Very uncomfortable", "q5a_raw": "Almost never",
        "q5b_raw": "Very uncomfortable", "q6_raw": "I need a 100% smoke-free room",
        "q7_raw": "I require an alcohol-free room", "q8_raw": "I am strict vegetarian and require a meat-free room",
        "q9_raw": "Budget-conscious - prefer to keep costs low", "q10_raw": "I prefer someone very similar to me"
    }

    client.post(
        "/api/public/forms/VALID_TOKEN/submit",
        json={
            "submitted_admission_number": student.admission_number,
            "submitted_phone_last4": student.phone_last4,
            "answers": answers
        }
    )
    prof1 = db_session.scalars(select(PreferenceProfile)).first()
    assert prof1.is_active is True

    # Resubmit
    client.post(
        "/api/public/forms/VALID_TOKEN/submit",
        json={
            "submitted_admission_number": student.admission_number,
            "submitted_phone_last4": student.phone_last4,
            "answers": answers
        }
    )
    
    profiles = db_session.scalars(select(PreferenceProfile).order_by(PreferenceProfile.created_at)).all()
    assert len(profiles) == 2
    assert profiles[0].is_active is False
    assert profiles[1].is_active is True
