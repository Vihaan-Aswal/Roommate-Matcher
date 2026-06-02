from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session
import uuid

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


def compute_segment_status(db: Session, segment_key: str, workspace_id: uuid.UUID) -> SegmentStatusResult:
    query = select(Segment).where(
        Segment.segment_key == segment_key,
        Segment.workspace_id == workspace_id
    )
    segment = db.scalars(query).first()
    if segment is None:
        raise KeyError(f"Segment not found: {segment_key}")

    student_query = select(func.count(Student.admission_number)).where(
        Student.segment_id == segment.id,
        Student.workspace_id == workspace_id,
        Student.is_active == True,
    )
    room_query = select(func.count(Room.room_id)).where(
        Room.segment_id == segment.id,
        Room.workspace_id == workspace_id,
    )
    capacity_query = select(func.coalesce(func.sum(Room.capacity), 0)).where(
        Room.segment_id == segment.id,
        Room.workspace_id == workspace_id,
    )
    student_rows_query = select(Student.id).where(
        Student.segment_id == segment.id,
        Student.workspace_id == workspace_id,
        Student.is_active == True,
    )

    student_count = db.scalar(student_query) or 0
    uploaded_room_count = db.scalar(room_query) or 0
    uploaded_capacity = db.scalar(capacity_query) or 0
    student_rows = db.scalars(student_rows_query).all()

    active_profiles_query = select(PreferenceProfile.student_id, PreferenceProfile.has_preferences).where(
        PreferenceProfile.student_id.in_(student_rows),
        PreferenceProfile.is_active == True,
        PreferenceProfile.workspace_id == workspace_id,
    )
    active_profiles = db.execute(active_profiles_query).all()
    profile_dict = {row.student_id: row.has_preferences for row in active_profiles}

    missing_preferences_count = 0
    for student_id in student_rows:
        has_pref = profile_dict.get(student_id)
        if has_pref is None or not has_pref:
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


def list_segment_overviews(db: Session, workspace_id: uuid.UUID) -> list[SegmentOverviewResult]:
    query = select(Segment).where(Segment.workspace_id == workspace_id).order_by(Segment.segment_key)
    segments = db.scalars(query).all()

    if not segments:
        return []

    segment_ids = [s.id for s in segments]

    student_counts = dict(
        db.execute(
            select(Student.segment_id, func.count(Student.id))
            .where(
                Student.workspace_id == workspace_id,
                Student.is_active == True,
                Student.segment_id.in_(segment_ids)
            )
            .group_by(Student.segment_id)
        ).all()
    )

    valid_profiles = dict(
        db.execute(
            select(Student.segment_id, func.count(Student.id))
            .join(PreferenceProfile, Student.id == PreferenceProfile.student_id)
            .where(
                Student.workspace_id == workspace_id,
                Student.is_active == True,
                Student.segment_id.in_(segment_ids),
                PreferenceProfile.workspace_id == workspace_id,
                PreferenceProfile.is_active == True,
                PreferenceProfile.has_preferences == True,
            )
            .group_by(Student.segment_id)
        ).all()
    )

    room_stats = db.execute(
        select(Room.segment_id, func.count(Room.room_id), func.coalesce(func.sum(Room.capacity), 0))
        .where(
            Room.workspace_id == workspace_id,
            Room.segment_id.in_(segment_ids)
        )
        .group_by(Room.segment_id)
    ).all()
    room_counts = {row[0]: row[1] for row in room_stats}
    room_capacities = {row[0]: row[2] for row in room_stats}

    overviews: list[SegmentOverviewResult] = []
    for segment in segments:
        student_count = student_counts.get(segment.id, 0)
        valid_count = valid_profiles.get(segment.id, 0)
        missing_count = student_count - valid_count
        missing_ratio = (missing_count / student_count) if student_count else 0.0

        uploaded_room_count = room_counts.get(segment.id, 0)
        uploaded_capacity = room_capacities.get(segment.id, 0)

        has_uploaded_rooms = uploaded_room_count > 0
        total_capacity = uploaded_capacity if has_uploaded_rooms else student_count

        if has_uploaded_rooms and student_count > total_capacity:
            status_val = "Impossible"
        elif missing_ratio > 0.2:
            status_val = "Risk"
        else:
            status_val = "Ready"

        overviews.append(
            SegmentOverviewResult(
                segment_key=segment.segment_key,
                gender=segment.gender,
                year_group=segment.year_group,
                ac_type=segment.ac_type,
                room_size=segment.room_size,
                status=status_val,
                student_count=student_count,
                total_capacity=total_capacity,
                missing_preferences_count=missing_count,
                missing_preferences_ratio=missing_ratio,
            )
        )

    return overviews


def get_segment_students_preference_status(db: Session, segment_key: str, workspace_id: uuid.UUID) -> SegmentStudentsResult:
    query = select(Segment).where(
        Segment.segment_key == segment_key,
        Segment.workspace_id == workspace_id
    )
    segment = db.scalars(query).first()
    if segment is None:
        raise KeyError(f"Segment not found: {segment_key}")

    student_query = select(Student).where(
        Student.segment_id == segment.id,
        Student.workspace_id == workspace_id,
        Student.is_active == True,
    ).order_by(Student.admission_number)
    students = db.scalars(student_query).all()

    student_ids = [s.id for s in students]

    profiles_query = select(PreferenceProfile).where(
        PreferenceProfile.student_id.in_(student_ids),
        PreferenceProfile.is_active == True,
        PreferenceProfile.workspace_id == workspace_id,
    )
    profiles = db.scalars(profiles_query).all()
    profile_map = {p.student_id: p for p in profiles}

    forms_query = select(FormResponse).where(
        FormResponse.student_id.in_(student_ids),
        FormResponse.workspace_id == workspace_id,
    ).order_by(FormResponse.student_id, desc(FormResponse.submitted_at), desc(FormResponse.id))
    forms = db.scalars(forms_query).all()
    latest_form_map = {}
    for f in forms:
        if f.student_id not in latest_form_map:
            latest_form_map[f.student_id] = f

    status_rows: list[SegmentStudentPreferenceStatus] = []
    for student in students:
        active_profile = profile_map.get(student.id)

        if active_profile is not None and active_profile.has_preferences is True:
            preference_status = "valid"
            has_valid_preferences = True
        elif active_profile is not None and active_profile.has_preferences is False:
            preference_status = "missing"
            has_valid_preferences = False
        else:
            latest_form = latest_form_map.get(student.id)
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
