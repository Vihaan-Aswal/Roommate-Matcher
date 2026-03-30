from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.form_response import FormResponse
from app.models.preference_profile import PreferenceProfile
from app.models.student import Student


QUESTION_KEYS = [
    "q1_raw",
    "q2_raw",
    "q3_raw",
    "q4a_raw",
    "q4b_raw",
    "q5a_raw",
    "q5b_raw",
    "q6_raw",
    "q7_raw",
    "q8_raw",
    "q9_raw",
    "q10_raw",
]

ENCODED_FIELD_MAP = {
    "q1_raw": "q1_enc",
    "q2_raw": "q2_enc",
    "q3_raw": "q3_enc",
    "q4a_raw": "q4a_enc",
    "q4b_raw": "q4b_enc",
    "q5a_raw": "q5a_enc",
    "q5b_raw": "q5b_enc",
    "q6_raw": "q6_enc",
    "q7_raw": "q7_enc",
    "q8_raw": "q8_enc",
    "q9_raw": "q9_enc",
    "q10_raw": "q10_enc",
}

QUESTION_OPTION_VALUES: dict[str, dict[str, float]] = {
    "q1_raw": {
        "Before 11 PM (early)": 1.0,
        "11 PM - 1 AM (normal)": 2.0,
        "1 AM - 3 AM (late)": 3.0,
        "After 3 AM (very late)": 4.0,
    },
    "q2_raw": {
        "Very tidy - I like things clean and organized": 1.0,
        "Tidy - I clean up a few times a week": 2.0,
        "Relaxed - I clean when it looks messy": 3.0,
    },
    "q3_raw": {
        "Before 10 PM": 1.0,
        "Between 10 PM and midnight": 2.0,
        "Often after midnight": 3.0,
    },
    "q4a_raw": {
        "Mainly for sleeping/studying, not for hanging out": 0.0,
        "Sometimes hang out with friends in the room": 1.0,
        "Often a hangout place, friends visit frequently": 2.0,
    },
    "q4b_raw": {
        "Very uncomfortable": 0.0,
        "Prefer to avoid, but can manage": 1.0,
        "Okay if it's occasional": 2.0,
        "Fine even if it's frequent": 3.0,
    },
    "q5a_raw": {
        "Almost never": 0.0,
        "Sometimes (a few nights a week)": 1.0,
        "Frequently (most nights)": 2.0,
    },
    "q5b_raw": {
        "Very uncomfortable": 0.0,
        "Prefer to avoid, but can manage": 1.0,
        "Okay if occasional": 2.0,
        "Fine even if frequent": 3.0,
    },
    "q6_raw": {
        "I need a 100% smoke-free room": 1.0,
        "I don't smoke but don't mind if roommates smoke (following hostel rules)": 2.0,
        "I am a smoker": 3.0,
    },
    "q7_raw": {
        "I require an alcohol-free room": 1.0,
        "I don't drink, but don't mind if roommates store/drink responsibly": 2.0,
        "I may store or drink (where allowed)": 3.0,
    },
    "q8_raw": {
        "I am strict vegetarian and require a meat-free room": 1.0,
        "I am vegetarian but okay if roommates keep/cook non-veg": 2.0,
        "I am non-vegetarian": 3.0,
    },
    "q9_raw": {
        "Budget-conscious - prefer to keep costs low": 1.0,
        "Standard - okay with reasonable shared costs": 2.0,
        "Flexible - willing to spend more for extra comfort": 3.0,
    },
    "q10_raw": {
        "I prefer someone very similar to me": 0.0,
        "I can manage some differences": 1.0,
        "I'm okay with many differences": 2.0,
        "I'm very flexible/open": 3.0,
    },
}


class FormIntakeError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class ValidationResult:
    is_valid: bool
    invalid_reason: str | None


def _to_utc_naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _normalize_raw_answers(raw_answers: dict[str, str | None]) -> dict[str, str | None]:
    normalized: dict[str, str | None] = {}
    for key in QUESTION_KEYS:
        value = raw_answers.get(key)
        if value is None:
            normalized[key] = None
            continue

        text = value.strip()
        normalized[key] = text or None
    return normalized


def _validate_answer_options(raw_answers: dict[str, str | None]) -> ValidationResult:
    for key in QUESTION_KEYS:
        value = raw_answers.get(key)
        if value is None:
            continue

        allowed_values = QUESTION_OPTION_VALUES[key]
        if value not in allowed_values:
            return ValidationResult(
                is_valid=False,
                invalid_reason=f"invalid_option_for_{key}",
            )

    return ValidationResult(is_valid=True, invalid_reason=None)


def _find_missing_answer_keys(raw_answers: dict[str, str | None]) -> list[str]:
    missing: list[str] = []
    for key in QUESTION_KEYS:
        if raw_answers.get(key) is None:
            missing.append(key)
    return missing


def _build_encoded_answers(raw_answers: dict[str, str | None]) -> dict[str, float]:
    encoded_answers: dict[str, float] = {}

    for key in QUESTION_KEYS:
        raw_value = raw_answers.get(key)
        encoded_key = ENCODED_FIELD_MAP[key]

        if raw_value is None:
            raise ValueError(f"Missing required answer for {key}")

        encoded_answers[encoded_key] = QUESTION_OPTION_VALUES[key][raw_value]

    return encoded_answers


def _latest_valid_profile(db: Session, admission_number: str) -> PreferenceProfile | None:
    query = (
        select(PreferenceProfile)
        .where(
            PreferenceProfile.admission_number == admission_number,
            PreferenceProfile.is_active == 1,
        )
        .order_by(desc(PreferenceProfile.updated_at), desc(PreferenceProfile.id))
        .limit(1)
    )
    return db.scalars(query).first()


def _deactivate_active_profiles(db: Session, admission_number: str) -> None:
    active_profiles = db.scalars(
        select(PreferenceProfile).where(
            PreferenceProfile.admission_number == admission_number,
            PreferenceProfile.is_active == 1,
        )
    ).all()
    for profile in active_profiles:
        profile.is_active = 0


def ingest_form_response(
    db: Session,
    admission_number: str,
    dob: date,
    raw_answers: dict[str, str | None],
    submitted_at: datetime | None = None,
) -> dict[str, Any]:
    student = db.get(Student, admission_number)
    if student is None:
        raise FormIntakeError(
            code="admission_number_not_found",
            message="Admission number was not found in the master student list.",
        )

    normalized_answers = _normalize_raw_answers(raw_answers)
    submitted_at_value = _to_utc_naive(submitted_at or datetime.now(tz=timezone.utc))

    if student.dob != dob:
        db.add(
            FormResponse(
                admission_number=admission_number,
                dob=dob,
                submitted_at=submitted_at_value,
                validation_status="invalid",
                invalid_reason="dob_mismatch",
                **normalized_answers,
            )
        )
        db.commit()
        raise FormIntakeError(
            code="dob_mismatch",
            message="DOB does not match the admission number.",
        )

    option_validation = _validate_answer_options(normalized_answers)
    missing_answer_keys = _find_missing_answer_keys(normalized_answers)
    if missing_answer_keys:
        db.add(
            FormResponse(
                admission_number=admission_number,
                dob=dob,
                submitted_at=submitted_at_value,
                validation_status="invalid",
                invalid_reason="incomplete_form_submission",
                **normalized_answers,
            )
        )
        db.commit()
        raise FormIntakeError(
            code="incomplete_form_submission",
            message="All form questions must be answered before submission.",
        )

    if not option_validation.is_valid:
        db.add(
            FormResponse(
                admission_number=admission_number,
                dob=dob,
                submitted_at=submitted_at_value,
                validation_status="invalid",
                invalid_reason=option_validation.invalid_reason,
                **normalized_answers,
            )
        )
        db.commit()
        raise FormIntakeError(
            code="invalid_form_option",
            message="One or more form answers are not valid options.",
        )

    form_response = FormResponse(
        admission_number=admission_number,
        dob=dob,
        submitted_at=submitted_at_value,
        validation_status="valid",
        invalid_reason=None,
        **normalized_answers,
    )
    db.add(form_response)
    db.flush()

    encoded_answers = _build_encoded_answers(normalized_answers)

    should_activate = True
    active_profile = _latest_valid_profile(db, admission_number)
    if active_profile is not None:
        previous_response = db.get(FormResponse, active_profile.source_form_response_id)
        if previous_response is not None and _to_utc_naive(previous_response.submitted_at) > submitted_at_value:
            should_activate = False

    if should_activate:
        _deactivate_active_profiles(db, admission_number)

    profile = PreferenceProfile(
        admission_number=admission_number,
        source_form_response_id=form_response.id,
        has_preferences=1,
        is_active=1 if should_activate else 0,
        **normalized_answers,
        **encoded_answers,
    )
    db.add(profile)
    db.commit()

    return {
        "status": "valid",
        "form_response_id": form_response.id,
        "preference_profile_id": profile.id,
        "is_active": bool(profile.is_active),
        "has_preferences": True,
    }
