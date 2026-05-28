"""
magic_fill/service.py — Generate synthetic preference profiles.

Fills in missing preference data for active students by randomly
selecting from the canonical answer options defined in
form_response.py.

All generated profiles are strictly marked with is_generated = TRUE.
"""
from __future__ import annotations

import random
import uuid
from dataclasses import dataclass

from sqlalchemy import select, and_, exists
from sqlalchemy.orm import Session

from app.models.preference_profile import PreferenceProfile
from app.models.segment import Segment
from app.models.student import Student
from app.services.ingestion.form_response import (
    QUESTION_KEYS,
    QUESTION_OPTION_VALUES,
    ENCODED_FIELD_MAP,
)


@dataclass(frozen=True)
class MagicFillResult:
    profiles_created: int
    students_skipped: int  # already had active profiles


def _generate_raw_answers() -> dict[str, str]:
    """
    Generate a complete set of raw answers by randomly selecting
    from QUESTION_OPTION_VALUES for each question key.

    Returns raw answer strings, NOT encoded numbers.
    """
    answers: dict[str, str] = {}
    for key in QUESTION_KEYS:
        options = list(QUESTION_OPTION_VALUES[key].keys())
        answers[key] = random.choice(options)
    return answers


def _encode_answers(raw_answers: dict[str, str]) -> dict[str, float]:
    """Convert raw answer strings to their encoded float values."""
    encoded: dict[str, float] = {}
    for raw_key, raw_value in raw_answers.items():
        enc_key = ENCODED_FIELD_MAP[raw_key]
        encoded[enc_key] = QUESTION_OPTION_VALUES[raw_key][raw_value]
    return encoded


def _find_students_missing_profiles(
    db: Session,
    workspace_id: uuid.UUID,
    segment_id: uuid.UUID | None = None,
) -> list[Student]:
    """
    Find active students in the workspace (optionally filtered by
    segment) who do NOT have an active preference profile.
    """
    # Subquery: students who have an active profile
    has_active_profile = (
        select(PreferenceProfile.student_id)
        .where(
            PreferenceProfile.workspace_id == workspace_id,
            PreferenceProfile.is_active == True,
        )
    )

    query = (
        select(Student)
        .where(
            Student.workspace_id == workspace_id,
            Student.is_active == True,
            ~Student.id.in_(has_active_profile),
        )
    )

    if segment_id is not None:
        query = query.where(Student.segment_id == segment_id)

    return list(db.scalars(query).all())


def magic_fill(
    db: Session,
    workspace_id: uuid.UUID,
    tenant_id: uuid.UUID,
    segment_id: uuid.UUID | None = None,
) -> MagicFillResult:
    """
    Generate preference profiles for students missing them.

    Parameters
    ----------
    db          : Database session.
    workspace_id: Target workspace.
    tenant_id   : Tenant owning the workspace.
    segment_id  : If provided, only fill students in this segment.
                  If None, fill ALL active students missing profiles
                  in the workspace.

    Returns
    -------
    MagicFillResult with counts.
    """
    # Count students that already have profiles (for reporting)
    all_active_count_query = (
        select(Student)
        .where(
            Student.workspace_id == workspace_id,
            Student.is_active == True,
        )
    )
    if segment_id is not None:
        all_active_count_query = all_active_count_query.where(
            Student.segment_id == segment_id
        )
    total_active = len(list(db.scalars(all_active_count_query).all()))

    students = _find_students_missing_profiles(db, workspace_id, segment_id)
    skipped = total_active - len(students)

    created = 0
    for student in students:
        raw_answers = _generate_raw_answers()
        encoded_answers = _encode_answers(raw_answers)

        profile = PreferenceProfile(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            student_id=student.id,
            source_form_response_id=None,  # no form response — generated
            has_preferences=True,
            is_active=True,
            is_generated=True,  # CRITICAL: always True for magic fill
            **raw_answers,
            **encoded_answers,
        )
        db.add(profile)
        created += 1

    if created > 0:
        db.commit()

    return MagicFillResult(
        profiles_created=created,
        students_skipped=skipped,
    )
