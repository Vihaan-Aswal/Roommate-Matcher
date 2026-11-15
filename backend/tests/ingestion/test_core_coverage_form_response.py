from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.form_response import FormResponse
from app.models.preference_profile import PreferenceProfile
from app.models.segment import Segment
from app.models.student import Student
from app.services.ingestion.form_response import (
    FormIntakeError,
    _build_encoded_answers,
    ingest_form_response,
)


def _seed_student(db_session: Session, admission_number: str = "ADM-COV-1") -> Student:
    segment = Segment(
        id=uuid.uuid4(),
        tenant_id=uuid.uuid4(),
        workspace_id=uuid.uuid4(),
        segment_key="M_1st_year_AC_2",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
    )
    db_session.add(segment)
    db_session.flush()
    student = Student(
        tenant_id=segment.tenant_id,
        workspace_id=segment.workspace_id,
        admission_number=admission_number,
        full_name="Coverage Student",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
        dob=date(2005, 1, 1),
        segment_id=segment.id,
        phone_number="1234567890",
        phone_last4="7890",
        is_active=True,
    )
    db_session.add(segment)
    db_session.add(student)
    db_session.commit()
    return student


def _valid_answers() -> dict[str, str | None]:
    return {
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


def test_build_encoded_answers_rejects_missing_answer() -> None:
    with pytest.raises(ValueError, match="Missing required answer for q1_raw"):
        _build_encoded_answers({})


def test_ingest_rejects_answer_outside_catalogue_and_persists_invalid_row(db_session: Session) -> None:
    student = _seed_student(db_session)
    answers = _valid_answers()
    answers["q3_raw"] = "Whenever I feel like it"

    with pytest.raises(FormIntakeError) as exc_info:
        ingest_form_response(
            db=db_session,
            workspace_id=student.workspace_id,
            admission_number="ADM-COV-1",
            phone_last4="7890",
            raw_answers=answers,
            submitted_at=datetime(2026, 3, 30, 12, 0, tzinfo=timezone.utc),
        )

    assert exc_info.value.code == "invalid_form_option"

    response = db_session.scalars(select(FormResponse)).one()
    assert response.validation_status == "invalid"
    assert response.invalid_reason == "invalid_option_for_q3_raw"
    assert db_session.scalars(select(PreferenceProfile)).all() == []


def test_ingest_keeps_newer_profile_active_when_older_submission_arrives_late(
    db_session: Session,
) -> None:
    student = _seed_student(db_session)

    newer = ingest_form_response(
        db=db_session,
        workspace_id=student.workspace_id,
        admission_number="ADM-COV-1",
        phone_last4="7890",
        raw_answers=_valid_answers(),
        submitted_at=datetime(2026, 3, 30, 12, 0, tzinfo=timezone.utc),
    )
    older = ingest_form_response(
        db=db_session,
        workspace_id=student.workspace_id,
        admission_number="ADM-COV-1",
        phone_last4="7890",
        raw_answers=_valid_answers(),
        submitted_at=datetime(2026, 3, 29, 12, 0, tzinfo=timezone.utc),
    )

    assert newer["is_active"] is True
    assert older["is_active"] is False

    profiles = db_session.scalars(select(PreferenceProfile)).all()
    assert len(profiles) == 2
    assert sorted(bool(profile.is_active) for profile in profiles) == [False, True]
