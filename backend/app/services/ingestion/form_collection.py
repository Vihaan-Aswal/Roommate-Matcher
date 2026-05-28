from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.form_response import FormResponse
from app.models.preference_profile import PreferenceProfile
from app.models.student import Student
from app.models.segment import Segment


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


def _valid_admissions(db: Session, workspace_id: uuid.UUID) -> set[str]:
    return set(
        db.scalars(
            select(Student.admission_number)
            .join(PreferenceProfile, PreferenceProfile.student_id == Student.id)
            .where(
                Student.workspace_id == workspace_id,
                PreferenceProfile.is_active == True,
                PreferenceProfile.has_preferences == True,
            )
        ).all()
    )


def _latest_form_status_by_admission(db: Session, workspace_id: uuid.UUID) -> dict[str, str]:
    latest_status: dict[str, str] = {}
    rows = db.scalars(
        select(FormResponse)
        .where(FormResponse.workspace_id == workspace_id)
        .order_by(desc(FormResponse.submitted_at), desc(FormResponse.id))
    ).all()
    for row in rows:
        if row.submitted_admission_number not in latest_status:
            latest_status[row.submitted_admission_number] = row.validation_status
    return latest_status


def compute_form_collection_status(db: Session, workspace_id: uuid.UUID) -> FormCollectionStatusResult:
    results = db.execute(
        select(Student, Segment.segment_key)
        .join(Segment, Student.segment_id == Segment.id)
        .where(Student.workspace_id == workspace_id)
        .order_by(Segment.segment_key, Student.admission_number)
    ).all()
    
    valid_admissions = _valid_admissions(db, workspace_id)
    latest_status = _latest_form_status_by_admission(db, workspace_id)

    total_students = len(results)
    valid_responses = sum(1 for student, _ in results if student.admission_number in valid_admissions)
    invalid_responses = sum(
        1
        for student, _ in results
        if latest_status.get(student.admission_number) == "invalid" and student.admission_number not in valid_admissions
    )
    percentage_valid = round((valid_responses / total_students) * 100, 2) if total_students else 0.0

    segment_map: dict[str, list[Student]] = {}
    for student, segment_key in results:
        segment_map.setdefault(segment_key, []).append(student)

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


def list_non_submitters(db: Session, workspace_id: uuid.UUID) -> list[NonSubmitterRecord]:
    valid_admissions = _valid_admissions(db, workspace_id)
    results = db.execute(
        select(Student, Segment.segment_key)
        .join(Segment, Student.segment_id == Segment.id)
        .where(Student.workspace_id == workspace_id)
        .order_by(Segment.segment_key, Student.admission_number)
    ).all()

    return [
        NonSubmitterRecord(
            admission_number=student.admission_number,
            full_name=student.full_name,
            segment_key=segment_key,
        )
        for student, segment_key in results
        if student.admission_number not in valid_admissions
    ]