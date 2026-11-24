"""Route matrix for the public form endpoints (no auth, token-scoped)."""
from __future__ import annotations

import uuid
from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models.form_response import FormResponse
from app.models.preference_profile import PreferenceProfile
from app.models.segment import Segment
from app.models.student import Student
from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.models.workspace_form_link import WorkspaceFormLink

VALID_ANSWERS = {
    "q1_raw": "Before 11 PM (early)",
    "q2_raw": "Very tidy - I like things clean and organized",
    "q3_raw": "Before 10 PM",
    "q4a_raw": "Mainly for sleeping/studying, not for hanging out",
    "q4b_raw": "Very uncomfortable",
    "q5a_raw": "Almost never",
    "q5b_raw": "Very uncomfortable",
    "q6_raw": "I need a 100% smoke-free room",
    "q7_raw": "I require an alcohol-free room",
    "q8_raw": "I am strict vegetarian and require a meat-free room",
    "q9_raw": "Budget-conscious - prefer to keep costs low",
    "q10_raw": "I prefer someone very similar to me",
}


@pytest.fixture
def form_setup(db_session: Session) -> dict[str, object]:
    tenant = Tenant(slug=f"pf-{uuid.uuid4().hex[:8]}", display_name="Public Form Tenant")
    db_session.add(tenant)
    db_session.flush()

    workspace = Workspace(tenant_id=tenant.id, name="Public Form Workspace", status="active")
    db_session.add(workspace)
    db_session.flush()

    segment = Segment(
        tenant_id=tenant.id,
        workspace_id=workspace.id,
        segment_key="PF_1st_year_AC_2",
        gender="F",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
    )
    db_session.add(segment)
    db_session.flush()

    student = Student(
        tenant_id=tenant.id,
        workspace_id=workspace.id,
        segment_id=segment.id,
        admission_number="PF001",
        full_name="Public Form Student",
        gender="F",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
        dob=date(2005, 1, 1),
        phone_number="9876543210",
        phone_last4="3210",
        is_active=True,
    )
    db_session.add(student)

    link = WorkspaceFormLink(
        tenant_id=tenant.id,
        workspace_id=workspace.id,
        public_form_token="PF-TOKEN",
        is_active=True,
    )
    db_session.add(link)
    db_session.commit()

    return {
        "tenant": tenant,
        "workspace": workspace,
        "student": student,
        "token": link.public_form_token,
    }


def _submit(client: TestClient, token: str, **overrides):
    body = {
        "submitted_admission_number": "PF001",
        "submitted_phone_last4": "3210",
        "answers": dict(VALID_ANSWERS),
    }
    body.update(overrides)
    return client.post(f"/api/public/forms/{token}/submit", json=body)


def test_get_public_form_rejects_unknown_or_inactive_token(
    client: TestClient, db_session: Session, form_setup
) -> None:
    unknown = client.get("/api/public/forms/NO-SUCH-TOKEN")
    assert unknown.status_code == 200
    assert unknown.json() == {"token_valid": False}

    link = db_session.query(WorkspaceFormLink).filter_by(public_form_token="PF-TOKEN").one()
    link.is_active = False
    db_session.commit()

    inactive = client.get("/api/public/forms/PF-TOKEN")
    assert inactive.json() == {"token_valid": False}


def test_get_public_form_returns_workspace_metadata(
    client: TestClient, form_setup
) -> None:
    response = client.get("/api/public/forms/PF-TOKEN")

    assert response.status_code == 200
    assert response.json() == {
        "workspace_display_name": "Public Form Workspace",
        "property_label": None,
        "is_open": True,
        "token_valid": True,
    }


def test_get_public_form_with_missing_workspace_is_invalid(
    client: TestClient, db_session: Session
) -> None:
    db_session.add(
        WorkspaceFormLink(
            tenant_id=uuid.uuid4(),
            workspace_id=uuid.uuid4(),
            public_form_token="PF-ORPHAN",
            is_active=True,
        )
    )
    db_session.commit()

    response = client.get("/api/public/forms/PF-ORPHAN")
    assert response.status_code == 200
    assert response.json() == {"token_valid": False}


def test_submit_rejects_unknown_token(client: TestClient) -> None:
    response = _submit(client, "NO-SUCH-TOKEN")
    assert response.status_code == 400
    assert response.json()["detail"] == {"error": "form_link_invalid"}


def test_submit_unknown_admission_number_is_recorded_as_invalid(
    client: TestClient, db_session: Session, form_setup
) -> None:
    response = _submit(client, "PF-TOKEN", submitted_admission_number="NOPE999")
    assert response.status_code == 200
    assert response.json() == {
        "status": "recorded",
        "valid": False,
        "error": "Verification failed",
    }

    stored = db_session.query(FormResponse).one()
    assert stored.validation_status == "invalid"
    assert stored.invalid_reason == "verification_failed"
    assert stored.student_id is None


def test_submit_wrong_phone_last4_is_recorded_against_the_student(
    client: TestClient, db_session: Session, form_setup
) -> None:
    response = _submit(client, "PF-TOKEN", submitted_phone_last4="0000")
    assert response.json()["valid"] is False

    stored = db_session.query(FormResponse).one()
    assert stored.invalid_reason == "verification_failed"
    assert stored.student_id == form_setup["student"].id


def test_submit_incomplete_form_is_rejected(
    client: TestClient, db_session: Session, form_setup
) -> None:
    partial = dict(VALID_ANSWERS)
    partial.pop("q7_raw")
    response = _submit(client, "PF-TOKEN", answers=partial)

    assert response.status_code == 200
    assert response.json() == {
        "status": "recorded",
        "valid": False,
        "error": "incomplete_form_submission",
    }
    stored = db_session.query(FormResponse).one()
    assert stored.invalid_reason == "incomplete_form_submission"


def test_submit_blank_answer_counts_as_missing(
    client: TestClient, db_session: Session, form_setup
) -> None:
    blanked = dict(VALID_ANSWERS)
    blanked["q2_raw"] = "   "
    response = _submit(client, "PF-TOKEN", answers=blanked)

    assert response.json()["error"] == "incomplete_form_submission"
    stored = db_session.query(FormResponse).one()
    assert stored.q2_raw is None


def test_submit_invalid_option_is_rejected(
    client: TestClient, db_session: Session, form_setup
) -> None:
    bad = dict(VALID_ANSWERS)
    bad["q1_raw"] = "Whenever"
    response = _submit(client, "PF-TOKEN", answers=bad)

    assert response.json()["error"] == "invalid_form_option"
    stored = db_session.query(FormResponse).one()
    assert stored.invalid_reason == "invalid_option_for_q1_raw"


def test_submit_valid_answers_creates_active_profile(
    client: TestClient, db_session: Session, form_setup
) -> None:
    response = _submit(client, "PF-TOKEN", answers=dict(VALID_ANSWERS))
    assert response.status_code == 200, response.text
    assert response.json() == {"status": "submitted", "valid": True}

    profile = db_session.query(PreferenceProfile).one()
    assert profile.is_active is True
    assert profile.has_preferences is True
    assert profile.is_generated is False
    assert profile.q1_raw == VALID_ANSWERS["q1_raw"]
    assert profile.q1_enc == 1.0


def test_resubmission_deactivates_the_previous_profile(
    client: TestClient, db_session: Session, form_setup
) -> None:
    assert _submit(client, "PF-TOKEN").json()["valid"] is True

    changed = dict(VALID_ANSWERS)
    changed["q1_raw"] = "11 PM - 1 AM (normal)"
    assert _submit(client, "PF-TOKEN", answers=changed).json()["valid"] is True

    profiles = (
        db_session.query(PreferenceProfile)
        .order_by(PreferenceProfile.created_at, PreferenceProfile.id)
        .all()
    )
    assert len(profiles) == 2
    active = [profile for profile in profiles if profile.is_active]
    assert len(active) == 1
    assert active[0].q1_raw == "11 PM - 1 AM (normal)"


def test_out_of_order_submission_does_not_replace_the_newer_profile(
    client: TestClient, db_session: Session, form_setup
) -> None:
    first = _submit(client, "PF-TOKEN")
    assert first.json()["valid"] is True
    first_profile = (
        db_session.query(PreferenceProfile)
        .filter(PreferenceProfile.is_active == True)  # noqa: E712
        .one()
    )

    # Simulate a submission that was recorded later but claims an earlier time:
    # the persisted (newer) response must stay the active profile source.
    db_session.execute(
        update(FormResponse).values(submitted_at=datetime(2999, 1, 1, 0, 0, 0))
    )
    db_session.commit()

    changed = dict(VALID_ANSWERS)
    changed["q2_raw"] = "Relaxed - I clean when it looks messy"
    second = _submit(client, "PF-TOKEN", answers=changed)
    assert second.json()["valid"] is True

    profiles = db_session.query(PreferenceProfile).all()
    assert len(profiles) == 2
    active = [profile for profile in profiles if profile.is_active]
    assert len(active) == 1
    assert active[0].id == first_profile.id
