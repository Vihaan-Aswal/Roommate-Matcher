from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

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


def compute_segment_status(db: Session, segment_key: str) -> SegmentStatusResult:
    segment = db.get(Segment, segment_key)
    if segment is None:
        raise KeyError(f"Segment not found: {segment_key}")

    student_count = db.scalar(
        select(func.count(Student.admission_number)).where(Student.segment_key == segment_key)
    ) or 0

    total_capacity = db.scalar(
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

    if student_count > total_capacity:
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
            ),
            student_count=student_count,
            total_capacity=total_capacity,
            missing_preferences_count=missing_preferences_count,
            missing_preferences_ratio=missing_ratio,
        )

    return SegmentStatusResult(
        segment_key=segment_key,
        status="Ready",
        reason="Segment is ready for matching.",
        student_count=student_count,
        total_capacity=total_capacity,
        missing_preferences_count=missing_preferences_count,
        missing_preferences_ratio=missing_ratio,
    )
