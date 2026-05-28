import pytest
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime

from app.models.workspace import Workspace
from app.models.student import Student
from app.models.form_response import FormResponse

def test_cross_workspace_isolation_token_cannot_resolve_students_in_other_workspace(client, test_setup, db_session):
    tenant = test_setup["tenant"]
    workspace2 = Workspace(tenant_id=tenant.id, name="W2", status="draft", source="manual")
    db_session.add(workspace2)
    db_session.commit()
    db_session.refresh(workspace2)

    student2 = Student(
        tenant_id=tenant.id,
        workspace_id=workspace2.id,
        segment_id=test_setup["student"].segment_id,
        admission_number="ADM002",
        full_name="Jane Doe",
        gender="F",
        year_group="Y1",
        ac_type="AC",
        room_size=2,
        dob=datetime(2000, 1, 1).date(),
        phone_number="1234567891",
        phone_last4="7891",
        is_active=True,
    )
    db_session.add(student2)
    db_session.commit()

    resp = client.post(
        "/api/public/forms/VALID_TOKEN/submit",
        json={
            "submitted_admission_number": "ADM002",
            "submitted_phone_last4": "7891",
            "answers": {}
        }
    )
    assert resp.status_code == 200
    assert resp.json()["error"] == "student_not_found"
    
    fr = db_session.scalars(select(FormResponse)).first()
    assert fr.student_id is None

def test_invalid_attempt_persistence(client, test_setup, db_session):
    answers = {
        "q1_raw": "INVALID OPTION", "q2_raw": "Very tidy - I like things clean and organized",
        "q3_raw": "Before 10 PM", "q4a_raw": "Mainly for sleeping/studying, not for hanging out",
        "q4b_raw": "Very uncomfortable", "q5a_raw": "Almost never",
        "q5b_raw": "Very uncomfortable", "q6_raw": "I need a 100% smoke-free room",
        "q7_raw": "I require an alcohol-free room", "q8_raw": "I am strict vegetarian and require a meat-free room",
        "q9_raw": "Budget-conscious - prefer to keep costs low", "q10_raw": "I prefer someone very similar to me"
    }
    resp = client.post(
        "/api/public/forms/VALID_TOKEN/submit",
        json={
            "submitted_admission_number": "ADM001",
            "submitted_phone_last4": "7890",
            "answers": answers
        }
    )
    assert resp.status_code == 200
    assert resp.json()["valid"] is False
    assert resp.json()["error"] == "invalid_form_option"

    fr = db_session.scalars(select(FormResponse)).first()
    assert fr.validation_status == "invalid"
    assert fr.invalid_reason == "invalid_option_for_q1_raw"

def test_resubmission_idempotency(client, test_setup, db_session):
    answers = {
        "q1_raw": "Before 11 PM (early)", "q2_raw": "Very tidy - I like things clean and organized",
        "q3_raw": "Before 10 PM", "q4a_raw": "Mainly for sleeping/studying, not for hanging out",
        "q4b_raw": "Very uncomfortable", "q5a_raw": "Almost never",
        "q5b_raw": "Very uncomfortable", "q6_raw": "I need a 100% smoke-free room",
        "q7_raw": "I require an alcohol-free room", "q8_raw": "I am strict vegetarian and require a meat-free room",
        "q9_raw": "Budget-conscious - prefer to keep costs low", "q10_raw": "I prefer someone very similar to me"
    }

    resp1 = client.post(
        "/api/public/forms/VALID_TOKEN/submit",
        json={
            "submitted_admission_number": "ADM001",
            "submitted_phone_last4": "7890",
            "answers": answers
        }
    )
    assert resp1.json()["valid"] is True

    resp2 = client.post(
        "/api/public/forms/VALID_TOKEN/submit",
        json={
            "submitted_admission_number": "ADM001",
            "submitted_phone_last4": "7890",
            "answers": answers
        }
    )
    assert resp2.json()["valid"] is True
    
    frs = db_session.scalars(select(FormResponse)).all()
    assert len(frs) == 2
