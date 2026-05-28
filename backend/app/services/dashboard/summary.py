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
from app.models.workspace import Workspace
from app.services.segments.status import compute_segment_status


@dataclass(frozen=True)
class DashboardSummaryResult:
    setup_status: dict[str, bool]
    form_collection_stats: dict[str, int | float]
    segments_status: dict[str, int]
    latest_matching_run: dict[str, str | None | object]
    workspace_name: str | None = None
    workspace_status: str | None = None
    generated_data_warning: dict[str, int | bool] | None = None


def get_workspace_dashboard_summary(db: Session, workspace: Workspace) -> DashboardSummaryResult:
    total_students = int(
        db.scalar(
            select(func.count(Student.admission_number)).where(
                Student.workspace_id == workspace.id, Student.is_active == True
            )
        )
        or 0
    )
    total_rooms = int(
        db.scalar(
            select(func.count(Room.id)).where(Room.workspace_id == workspace.id)
        )
        or 0
    )
    total_forms = int(
        db.scalar(
            select(func.count(FormResponse.id)).where(FormResponse.workspace_id == workspace.id)
        )
        or 0
    )

    valid_preferences = int(
        db.scalar(
            select(func.count(PreferenceProfile.student_id)).where(
                PreferenceProfile.workspace_id == workspace.id,
                PreferenceProfile.is_active == True,
                PreferenceProfile.has_preferences == True,
            )
        )
        or 0
    )

    segments = db.scalars(
        select(Segment).where(Segment.workspace_id == workspace.id).order_by(Segment.segment_key)
    ).all()
    ready = 0
    impossible = 0
    risk = 0
    for segment in segments:
        status = compute_segment_status(db, segment.segment_key, workspace.id).status
        if status == "Ready":
            ready += 1
        elif status == "Impossible":
            impossible += 1
        elif status == "Risk":
            risk += 1

    latest_run = db.scalars(
        select(MatchingRun)
        .where(MatchingRun.workspace_id == workspace.id)
        .order_by(MatchingRun.created_at.desc())
        .limit(1)
    ).first()

    percentage_complete = round((valid_preferences / total_students) * 100, 2) if total_students else 0.0

    # Generated data warning
    generated_profiles_count = int(
        db.scalar(
            select(func.count(PreferenceProfile.id)).where(
                PreferenceProfile.workspace_id == workspace.id,
                PreferenceProfile.is_active == True,
                PreferenceProfile.is_generated == True,
            )
        )
        or 0
    )

    return DashboardSummaryResult(
        workspace_name=workspace.name,
        workspace_status=workspace.status,
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
        generated_data_warning={
            "has_generated_data": generated_profiles_count > 0,
            "generated_profiles_count": generated_profiles_count,
            "total_active_profiles": valid_preferences,
        },
    )


def get_dashboard_summary(db: Session) -> DashboardSummaryResult:
    total_students = int(db.scalar(select(func.count(Student.admission_number))) or 0)
    total_rooms = int(db.scalar(select(func.count(Room.id))) or 0)
    total_forms = int(db.scalar(select(func.count(FormResponse.id))) or 0)

    valid_preferences = int(
        db.scalar(
            select(func.count(PreferenceProfile.student_id)).where(
                PreferenceProfile.is_active == True,
                PreferenceProfile.has_preferences == True,
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
