from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.form_response import FormResponse
from app.models.preference_profile import PreferenceProfile
from app.models.student import Student


@dataclass(frozen=True)
class SegmentFormCollectionStat:
    segment_key: str
    total: int
    valid: int
    percentage: float


@dataclass(frozen=True)
class FormCollectionStatusResult:
    total_students: int
    valid_responses: int
    invalid_responses: int
    percentage_valid: float
    by_segment: list[SegmentFormCollectionStat]


@dataclass(frozen=True)
class NonSubmitterRecord:
    admission_number: str
    full_name: str
    segment_key: str


def _valid_admissions(db: Session) -> set[str]:
    return set(
        db.scalars(
            select(PreferenceProfile.admission_number).where(
                PreferenceProfile.is_active == 1,
                PreferenceProfile.has_preferences == 1,
            )
        ).all()
    )


def _latest_form_status_by_admission(db: Session) -> dict[str, str]:
    latest_status: dict[str, str] = {}
    rows = db.scalars(
        select(FormResponse).order_by(desc(FormResponse.submitted_at), desc(FormResponse.id))
    ).all()
    for row in rows:
        if row.admission_number not in latest_status:
            latest_status[row.admission_number] = row.validation_status
    return latest_status


def compute_form_collection_status(db: Session) -> FormCollectionStatusResult:
    students = db.scalars(select(Student).order_by(Student.segment_key, Student.admission_number)).all()
    valid_admissions = _valid_admissions(db)
    latest_status = _latest_form_status_by_admission(db)

    total_students = len(students)
    valid_responses = sum(1 for student in students if student.admission_number in valid_admissions)
    invalid_responses = sum(
        1
        for student in students
        if latest_status.get(student.admission_number) == "invalid" and student.admission_number not in valid_admissions
    )
    percentage_valid = round((valid_responses / total_students) * 100, 2) if total_students else 0.0

    segment_map: dict[str, list[Student]] = {}
    for student in students:
        segment_map.setdefault(student.segment_key, []).append(student)

    by_segment: list[SegmentFormCollectionStat] = []
    for segment_key in sorted(segment_map):
        segment_students = segment_map[segment_key]
        segment_total = len(segment_students)
        segment_valid = sum(
            1 for student in segment_students if student.admission_number in valid_admissions
        )
        segment_percentage = round((segment_valid / segment_total) * 100, 2) if segment_total else 0.0
        by_segment.append(
            SegmentFormCollectionStat(
                segment_key=segment_key,
                total=segment_total,
                valid=segment_valid,
                percentage=segment_percentage,
            )
        )

    return FormCollectionStatusResult(
        total_students=total_students,
        valid_responses=valid_responses,
        invalid_responses=invalid_responses,
        percentage_valid=percentage_valid,
        by_segment=by_segment,
    )


def list_non_submitters(db: Session) -> list[NonSubmitterRecord]:
    valid_admissions = _valid_admissions(db)
    students = db.scalars(
        select(Student).order_by(Student.segment_key, Student.admission_number)
    ).all()

    return [
        NonSubmitterRecord(
            admission_number=student.admission_number,
            full_name=student.full_name,
            segment_key=student.segment_key,
        )
        for student in students
        if student.admission_number not in valid_admissions
    ]