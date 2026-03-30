from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.form_response import FormResponse
from app.models.preference_profile import PreferenceProfile
from app.models.segment import Segment
from app.models.student import Student
from app.services.ingestion.form_response import FormIntakeError, ingest_form_response


def _seed_student(db_session: Session, admission_number: str = "ADM100") -> Student:
    segment = Segment(
        segment_key="M_1st_year_AC_2",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
    )
    student = Student(
        admission_number=admission_number,
        full_name="Test Student",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
        dob=date(2005, 1, 1),
        segment_key="M_1st_year_AC_2",
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


def test_ingest_form_response_accepts_valid_submission(db_session: Session) -> None:
    _seed_student(db_session)

    result = ingest_form_response(
        db=db_session,
        admission_number="ADM100",
        dob=date(2005, 1, 1),
        raw_answers=_valid_answers(),
        submitted_at=datetime(2026, 3, 30, 12, 0, tzinfo=timezone.utc),
    )

    assert result["status"] == "valid"
    assert result["is_active"] is True
    assert result["has_preferences"] is True

    form_response = db_session.scalars(select(FormResponse)).first()
    assert form_response is not None
    assert form_response.validation_status == "valid"

    profile = db_session.scalars(select(PreferenceProfile)).first()
    assert profile is not None
    assert profile.is_active == 1
    assert profile.q1_enc == 1.0
    assert profile.q10_enc == 0.0


def test_ingest_form_response_rejects_unknown_admission_number(db_session: Session) -> None:
    try:
        ingest_form_response(
            db=db_session,
            admission_number="UNKNOWN",
            dob=date(2005, 1, 1),
            raw_answers=_valid_answers(),
        )
        raise AssertionError("Expected FormIntakeError for unknown admission number")
    except FormIntakeError as exc:
        assert exc.code == "admission_number_not_found"

    assert db_session.query(FormResponse).count() == 0
    assert db_session.query(PreferenceProfile).count() == 0


def test_ingest_form_response_rejects_dob_mismatch_and_persists_invalid_response(db_session: Session) -> None:
    _seed_student(db_session)

    try:
        ingest_form_response(
            db=db_session,
            admission_number="ADM100",
            dob=date(2005, 2, 2),
            raw_answers=_valid_answers(),
        )
        raise AssertionError("Expected FormIntakeError for dob mismatch")
    except FormIntakeError as exc:
        assert exc.code == "dob_mismatch"

    responses = db_session.scalars(select(FormResponse)).all()
    assert len(responses) == 1
    assert responses[0].validation_status == "invalid"
    assert responses[0].invalid_reason == "dob_mismatch"
    assert db_session.query(PreferenceProfile).count() == 0


def test_ingest_form_response_applies_latest_valid_wins(db_session: Session) -> None:
    _seed_student(db_session)

    first_answers = _valid_answers()
    second_answers = _valid_answers()
    second_answers["q1_raw"] = "After 3 AM (very late)"

    ingest_form_response(
        db=db_session,
        admission_number="ADM100",
        dob=date(2005, 1, 1),
        raw_answers=first_answers,
        submitted_at=datetime(2026, 3, 30, 12, 0, tzinfo=timezone.utc),
    )
    ingest_form_response(
        db=db_session,
        admission_number="ADM100",
        dob=date(2005, 1, 1),
        raw_answers=second_answers,
        submitted_at=datetime(2026, 3, 30, 12, 5, tzinfo=timezone.utc),
    )

    profiles = db_session.scalars(
        select(PreferenceProfile)
        .where(PreferenceProfile.admission_number == "ADM100")
        .order_by(PreferenceProfile.id)
    ).all()

    assert len(profiles) == 2
    assert profiles[0].is_active == 0
    assert profiles[1].is_active == 1
    assert profiles[1].q1_enc == 4.0


def test_ingest_form_response_rejects_incomplete_submission(db_session: Session) -> None:
    _seed_student(db_session)

    partial_answers = _valid_answers()
    partial_answers["q5b_raw"] = None
    partial_answers["q8_raw"] = None

    try:
        ingest_form_response(
            db=db_session,
            admission_number="ADM100",
            dob=date(2005, 1, 1),
            raw_answers=partial_answers,
        )
        raise AssertionError("Expected FormIntakeError for incomplete form submission")
    except FormIntakeError as exc:
        assert exc.code == "incomplete_form_submission"

    responses = db_session.scalars(select(FormResponse)).all()
    assert len(responses) == 1
    assert responses[0].validation_status == "invalid"
    assert responses[0].invalid_reason == "incomplete_form_submission"

    profile = db_session.scalars(select(PreferenceProfile)).first()
    assert profile is None
