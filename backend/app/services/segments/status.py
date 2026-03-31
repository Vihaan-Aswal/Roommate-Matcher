from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.form_response import FormResponse
from app.models.preference_profile import PreferenceProfile
from app.models.room import Room
from app.models.segment import Segment
from app.models.student import Student


@dataclass
class SegmentStatusResult:
    segment_key: str
    status: str
    reason: str
    student_count: int
    total_capacity: int
    missing_preferences_count: int
    missing_preferences_ratio: float

    def as_dict(self) -> dict[str, str | int | float]:
        return {
            "segment_key": self.segment_key,
            "status": self.status,
            "reason": self.reason,
            "student_count": self.student_count,
            "total_capacity": self.total_capacity,
            "missing_preferences_count": self.missing_preferences_count,
            "missing_preferences_ratio": round(self.missing_preferences_ratio, 4),
        }


@dataclass
class SegmentOverviewResult:
    segment_key: str
    gender: str
    year_group: str
    ac_type: str
    room_size: int
    status: str
    student_count: int
    total_capacity: int
    missing_preferences_count: int
    missing_preferences_ratio: float


@dataclass
class SegmentStudentPreferenceStatus:
    admission_number: str
    full_name: str
    has_valid_preferences: bool
    preference_status: str


@dataclass
class SegmentStudentsResult:
    segment_key: str
    room_size: int
    students: list[SegmentStudentPreferenceStatus]


def compute_segment_status(db: Session, segment_key: str) -> SegmentStatusResult:
    segment = db.get(Segment, segment_key)
    if segment is None:
        raise KeyError(f"Segment not found: {segment_key}")

    student_count = db.scalar(
        select(func.count(Student.admission_number)).where(Student.segment_key == segment_key)
    ) or 0

    uploaded_room_count = db.scalar(
        select(func.count(Room.room_id)).where(Room.segment_key == segment_key)
    ) or 0

    uploaded_capacity = db.scalar(
        select(func.coalesce(func.sum(Room.capacity), 0)).where(Room.segment_key == segment_key)
    ) or 0

    student_rows = db.scalars(
        select(Student.admission_number).where(Student.segment_key == segment_key)
    ).all()

    missing_preferences_count = 0
    for admission_number in student_rows:
        active_profile = db.scalars(
            select(PreferenceProfile)
            .where(
                PreferenceProfile.admission_number == admission_number,
                PreferenceProfile.is_active == 1,
            )
            .limit(1)
        ).first()

        if active_profile is None or active_profile.has_preferences == 0:
            missing_preferences_count += 1

    missing_ratio = (missing_preferences_count / student_count) if student_count else 0.0

    has_uploaded_rooms = uploaded_room_count > 0
    total_capacity = uploaded_capacity if has_uploaded_rooms else student_count

    if has_uploaded_rooms and student_count > total_capacity:
        return SegmentStatusResult(
            segment_key=segment_key,
            status="Impossible",
            reason=(
                "Not enough room capacity for this segment "
                f"({student_count} students for {total_capacity} beds)."
            ),
            student_count=student_count,
            total_capacity=total_capacity,
            missing_preferences_count=missing_preferences_count,
            missing_preferences_ratio=missing_ratio,
        )

    if missing_ratio > 0.2:
        return SegmentStatusResult(
            segment_key=segment_key,
            status="Risk",
            reason=(
                "More than 20% of students have missing preferences "
                f"({missing_preferences_count}/{student_count})."
            )
            if has_uploaded_rooms
            else (
                "More than 20% of students have missing preferences "
                f"({missing_preferences_count}/{student_count}). "
                "Rooms are not uploaded, so capacity will be auto-generated at matching time."
            ),
            student_count=student_count,
            total_capacity=total_capacity,
            missing_preferences_count=missing_preferences_count,
            missing_preferences_ratio=missing_ratio,
        )

    return SegmentStatusResult(
        segment_key=segment_key,
        status="Ready",
        reason=(
            "Segment is ready for matching."
            if has_uploaded_rooms
            else "Segment is ready for matching; room capacity will be auto-generated at matching time."
        ),
        student_count=student_count,
        total_capacity=total_capacity,
        missing_preferences_count=missing_preferences_count,
        missing_preferences_ratio=missing_ratio,
    )


def list_segment_overviews(db: Session) -> list[SegmentOverviewResult]:
    segments = db.scalars(select(Segment).order_by(Segment.segment_key)).all()

    overviews: list[SegmentOverviewResult] = []
    for segment in segments:
        status = compute_segment_status(db, segment.segment_key)
        overviews.append(
            SegmentOverviewResult(
                segment_key=segment.segment_key,
                gender=segment.gender,
                year_group=segment.year_group,
                ac_type=segment.ac_type,
                room_size=segment.room_size,
                status=status.status,
                student_count=status.student_count,
                total_capacity=status.total_capacity,
                missing_preferences_count=status.missing_preferences_count,
                missing_preferences_ratio=status.missing_preferences_ratio,
            )
        )

    return overviews


def get_segment_students_preference_status(db: Session, segment_key: str) -> SegmentStudentsResult:
    segment = db.get(Segment, segment_key)
    if segment is None:
        raise KeyError(f"Segment not found: {segment_key}")

    students = db.scalars(
        select(Student)
        .where(Student.segment_key == segment_key)
        .order_by(Student.admission_number)
    ).all()

    status_rows: list[SegmentStudentPreferenceStatus] = []
    for student in students:
        active_profile = db.scalars(
            select(PreferenceProfile)
            .where(
                PreferenceProfile.admission_number == student.admission_number,
                PreferenceProfile.is_active == 1,
            )
            .limit(1)
        ).first()

        if active_profile is not None and active_profile.has_preferences == 1:
            preference_status = "valid"
            has_valid_preferences = True
        elif active_profile is not None and active_profile.has_preferences == 0:
            preference_status = "missing"
            has_valid_preferences = False
        else:
            latest_form = db.scalars(
                select(FormResponse)
                .where(FormResponse.admission_number == student.admission_number)
                .order_by(desc(FormResponse.submitted_at), desc(FormResponse.id))
                .limit(1)
            ).first()
            if latest_form is not None and latest_form.validation_status == "invalid":
                preference_status = "invalid"
            else:
                preference_status = "missing"
            has_valid_preferences = False

        status_rows.append(
            SegmentStudentPreferenceStatus(
                admission_number=student.admission_number,
                full_name=student.full_name,
                has_valid_preferences=has_valid_preferences,
                preference_status=preference_status,
            )
        )

    return SegmentStudentsResult(
        segment_key=segment_key,
        room_size=segment.room_size,
        students=status_rows,
    )
