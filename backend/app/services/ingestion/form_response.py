from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any, Sequence

from sqlalchemy import desc, insert, select, update
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


def _latest_valid_profile(db: Session, student_id: uuid.UUID) -> PreferenceProfile | None:
    query = (
        select(PreferenceProfile)
        .where(
            PreferenceProfile.student_id == student_id,
            PreferenceProfile.is_active == True,
        )
        .order_by(desc(PreferenceProfile.updated_at), desc(PreferenceProfile.id))
        .limit(1)
    )
    return db.scalars(query).first()


def _deactivate_active_profiles(db: Session, student_id: uuid.UUID) -> None:
    active_profiles = db.scalars(
        select(PreferenceProfile).where(
            PreferenceProfile.student_id == student_id,
            PreferenceProfile.is_active == True,
        )
    ).all()
    for profile in active_profiles:
        profile.is_active = False


@dataclass(frozen=True)
class BulkFormSubmission:
    admission_number: str
    phone_last4: str
    raw_answers: dict[str, str | None]


def _invalid_response_row(
    student: Student,
    admission_number: str,
    phone_last4: str,
    submitted_at: datetime,
    reason: str,
    answers: dict[str, str | None],
) -> dict[str, Any]:
    return {
        "id": uuid.uuid4(),
        "tenant_id": student.tenant_id,
        "workspace_id": student.workspace_id,
        "student_id": student.id,
        "submitted_admission_number": admission_number,
        "submitted_phone_last4": phone_last4,
        "submitted_at": submitted_at,
        "validation_status": "invalid",
        "invalid_reason": reason,
        **answers,
    }


def ingest_form_responses_bulk(
    db: Session,
    workspace_id: uuid.UUID,
    submissions: Sequence[BulkFormSubmission],
) -> list[str | None]:
    """Ingest many responses in a single transaction (demo seed fast path).

    Returns one code per submission, in order: None when accepted, otherwise
    the FormIntakeError code the per-row path would have raised.

    Same rules as ingest_form_response: the same invalid rows are recorded and
    the same row is rejected. The only difference is that rows are written with
    two multi-row INSERTs and one commit instead of a flush and commit per row.
    """
    if not submissions:
        return []

    students = {
        student.admission_number: student
        for student in db.scalars(
            select(Student).where(
                Student.workspace_id == workspace_id,
                Student.is_active == True,
            )
        ).all()
    }

    submitted_at = _to_utc_naive(datetime.now(tz=timezone.utc))

    # Latest valid wins: an active profile whose source response is newer than
    # this batch must stay active. One query instead of two per row.
    newer_active_students = {
        student_id
        for student_id, previous_at in db.execute(
            select(PreferenceProfile.student_id, FormResponse.submitted_at)
            .join(FormResponse, PreferenceProfile.source_form_response_id == FormResponse.id)
            .where(
                PreferenceProfile.workspace_id == workspace_id,
                PreferenceProfile.is_active == True,
            )
        ).all()
        if _to_utc_naive(previous_at) > submitted_at
    }

    codes: list[str | None] = []
    response_rows: list[dict[str, Any]] = []
    pending_profiles: list[tuple[Student, uuid.UUID, dict[str, str | None], bool]] = []

    for submission in submissions:
        student = students.get(submission.admission_number)
        if student is None:
            codes.append("admission_number_not_found")
            continue

        normalized_answers = _normalize_raw_answers(submission.raw_answers)

        if student.phone_last4 != submission.phone_last4:
            response_rows.append(
                _invalid_response_row(
                    student,
                    submission.admission_number,
                    submission.phone_last4,
                    submitted_at,
                    "phone_mismatch",
                    normalized_answers,
                )
            )
            codes.append("phone_mismatch")
            continue

        if _find_missing_answer_keys(normalized_answers):
            response_rows.append(
                _invalid_response_row(
                    student,
                    submission.admission_number,
                    student.phone_last4,
                    submitted_at,
                    "incomplete_form_submission",
                    normalized_answers,
                )
            )
            codes.append("incomplete_form_submission")
            continue

        option_validation = _validate_answer_options(normalized_answers)
        if not option_validation.is_valid:
            response_rows.append(
                _invalid_response_row(
                    student,
                    submission.admission_number,
                    student.phone_last4,
                    submitted_at,
                    str(option_validation.invalid_reason),
                    normalized_answers,
                )
            )
            codes.append("invalid_form_option")
            continue

        form_response_id = uuid.uuid4()
        response_rows.append(
            {
                "id": form_response_id,
                "tenant_id": student.tenant_id,
                "workspace_id": student.workspace_id,
                "student_id": student.id,
                "submitted_admission_number": submission.admission_number,
                "submitted_phone_last4": student.phone_last4,
                "submitted_at": submitted_at,
                "validation_status": "valid",
                "invalid_reason": None,
                **normalized_answers,
            }
        )
        pending_profiles.append(
            (student, form_response_id, normalized_answers, student.id not in newer_active_students)
        )
        codes.append(None)

    if response_rows:
        # Chunked for the same bind-parameter reason as the CSV importers.
        for start in range(0, len(response_rows), 500):
            db.execute(insert(FormResponse).values(response_rows[start : start + 500]))

    # Repeated submissions for one student in a batch follow the same
    # latest-valid-wins rule: only the last one stays active.
    last_active_index = {
        student.id: index
        for index, (student, _response_id, _answers, activate) in enumerate(pending_profiles)
        if activate
    }
    pending_profiles = [
        (
            student,
            form_response_id,
            normalized_answers,
            activate and last_active_index.get(student.id) == index,
        )
        for index, (student, form_response_id, normalized_answers, activate) in enumerate(pending_profiles)
    ]

    active_student_ids = [student.id for student, _, _, activate in pending_profiles if activate]
    if active_student_ids:
        db.execute(
            update(PreferenceProfile)
            .where(
                PreferenceProfile.workspace_id == workspace_id,
                PreferenceProfile.student_id.in_(active_student_ids),
                PreferenceProfile.is_active == True,
            )
            .values(is_active=False)
        )

    if pending_profiles:
        profile_rows = [
            {
                "id": uuid.uuid4(),
                "tenant_id": student.tenant_id,
                "workspace_id": student.workspace_id,
                "student_id": student.id,
                "source_form_response_id": form_response_id,
                "has_preferences": True,
                "is_active": should_activate,
                "is_generated": False,
                **normalized_answers,
                **_build_encoded_answers(normalized_answers),
            }
            for student, form_response_id, normalized_answers, should_activate in pending_profiles
        ]
        for start in range(0, len(profile_rows), 500):
            db.execute(insert(PreferenceProfile).values(profile_rows[start : start + 500]))

    db.commit()
    return codes


def ingest_form_response(
    db: Session,
    workspace_id: uuid.UUID,
    admission_number: str,
    phone_last4: str,
    raw_answers: dict[str, str | None],
    submitted_at: datetime | None = None,
) -> dict[str, Any]:
    student = db.scalars(
        select(Student)
        .where(
            Student.workspace_id == workspace_id,
            Student.admission_number == admission_number,
            Student.is_active == True
        )
        .order_by(Student.created_at.desc())
    ).first()
    if student is None:
        raise FormIntakeError(
            code="admission_number_not_found",
            message="Admission number was not found in the master student list.",
        )

    normalized_answers = _normalize_raw_answers(raw_answers)
    submitted_at_value = _to_utc_naive(submitted_at or datetime.now(tz=timezone.utc))

    if student.phone_last4 != phone_last4:
        db.add(
            FormResponse(
                tenant_id=student.tenant_id,
                workspace_id=student.workspace_id,
                student_id=student.id,
                submitted_admission_number=admission_number,
                submitted_phone_last4=phone_last4,
                submitted_at=submitted_at_value,
                validation_status="invalid",
                invalid_reason="phone_mismatch",
                **normalized_answers,
            )
        )
        db.commit()
        raise FormIntakeError(
            code="phone_mismatch",
            message="Phone number did not match.",
        )

    option_validation = _validate_answer_options(normalized_answers)
    missing_answer_keys = _find_missing_answer_keys(normalized_answers)
    if missing_answer_keys:
        db.add(
            FormResponse(
                tenant_id=student.tenant_id,
                workspace_id=student.workspace_id,
                student_id=student.id,
                submitted_admission_number=admission_number,
                submitted_phone_last4=student.phone_last4,
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
                tenant_id=student.tenant_id,
                workspace_id=student.workspace_id,
                student_id=student.id,
                submitted_admission_number=admission_number,
                submitted_phone_last4=student.phone_last4,
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
        tenant_id=student.tenant_id,
        workspace_id=student.workspace_id,
        student_id=student.id,
        submitted_admission_number=admission_number,
        submitted_phone_last4=student.phone_last4,
        submitted_at=submitted_at_value,
        validation_status="valid",
        invalid_reason=None,
        **normalized_answers,
    )
    db.add(form_response)
    db.flush()

    encoded_answers = _build_encoded_answers(normalized_answers)

    should_activate = True
    active_profile = _latest_valid_profile(db, student.id)
    if active_profile is not None:
        previous_response = db.get(FormResponse, active_profile.source_form_response_id)
        if previous_response is not None and _to_utc_naive(previous_response.submitted_at) > submitted_at_value:
            should_activate = False

    if should_activate:
        _deactivate_active_profiles(db, student.id)
        db.flush()

    profile = PreferenceProfile(
        tenant_id=student.tenant_id,
        workspace_id=student.workspace_id,
        student_id=student.id,
        source_form_response_id=form_response.id,
        has_preferences=True,
        is_active=should_activate,
        is_generated=False,
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
