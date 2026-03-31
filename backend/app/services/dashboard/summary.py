from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.form_response import FormResponse
from app.models.matching_run import MatchingRun
from app.models.preference_profile import PreferenceProfile
from app.models.room import Room
from app.models.segment import Segment
from app.models.student import Student
from app.services.segments.status import compute_segment_status


@dataclass(frozen=True)
class DashboardSummaryResult:
    setup_status: dict[str, bool]
    form_collection_stats: dict[str, int | float]
    segments_status: dict[str, int]
    latest_matching_run: dict[str, str | None | object]


def get_dashboard_summary(db: Session) -> DashboardSummaryResult:
    total_students = int(db.scalar(select(func.count(Student.admission_number))) or 0)
    total_rooms = int(db.scalar(select(func.count(Room.id))) or 0)
    total_forms = int(db.scalar(select(func.count(FormResponse.id))) or 0)

    valid_preferences = int(
        db.scalar(
            select(func.count(PreferenceProfile.admission_number)).where(
                PreferenceProfile.is_active == 1,
                PreferenceProfile.has_preferences == 1,
            )
        )
        or 0
    )

    segments = db.scalars(select(Segment).order_by(Segment.segment_key)).all()
    ready = 0
    impossible = 0
    risk = 0
    for segment in segments:
        status = compute_segment_status(db, segment.segment_key).status
        if status == "Ready":
            ready += 1
        elif status == "Impossible":
            impossible += 1
        elif status == "Risk":
            risk += 1

    latest_run = db.scalars(
        select(MatchingRun).order_by(MatchingRun.created_at.desc()).limit(1)
    ).first()

    percentage_complete = round((valid_preferences / total_students) * 100, 2) if total_students else 0.0

    return DashboardSummaryResult(
        setup_status={
            "master_students_uploaded": total_students > 0,
            "rooms_uploaded": total_rooms > 0,
            "forms_collection_started": total_forms > 0,
            "at_least_one_segment_ready": ready > 0,
        },
        form_collection_stats={
            "total_students": total_students,
            "students_with_valid_preferences": valid_preferences,
            "percentage_complete": percentage_complete,
        },
        segments_status={
            "total_segments": len(segments),
            "ready": ready,
            "impossible": impossible,
            "at_risk": risk,
        },
        latest_matching_run={
            "run_id": latest_run.run_id if latest_run else None,
            "status": latest_run.status if latest_run else None,
            "created_at": latest_run.created_at if latest_run else None,
        },
    )
