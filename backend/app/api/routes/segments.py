from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.segment import SegmentListResponse, SegmentStatusResponse, SegmentStudentsResponse
from app.services.segments.status import (
    compute_segment_status,
    get_segment_students_preference_status,
    list_segment_overviews,
)


import uuid
from app.auth.dependencies import require_workspace_access
from app.auth.contracts import AuthenticatedUser
from app.models.tenant import Tenant
from app.models.workspace import Workspace

router = APIRouter(prefix="/api/workspaces/{workspace_id}/segments", tags=["segments"])


@router.get("", response_model=SegmentListResponse)
def list_segments(
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> SegmentListResponse:
    rows = list_segment_overviews(db, workspace_id)
    return SegmentListResponse(
        segments=[
            {
                "segment_key": row.segment_key,
                "gender": row.gender,
                "year_group": row.year_group,
                "ac_type": row.ac_type,
                "room_size": row.room_size,
                "status": row.status,
                "student_count": row.student_count,
                "total_capacity": row.total_capacity,
                "missing_preferences_count": row.missing_preferences_count,
                "missing_preferences_ratio": row.missing_preferences_ratio,
            }
            for row in rows
        ]
    )


@router.get("/{segment_key}", response_model=SegmentStatusResponse)
def get_segment_status(
    workspace_id: uuid.UUID,
    segment_key: str,
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> SegmentStatusResponse:
    try:
        status = compute_segment_status(db, segment_key, workspace_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return SegmentStatusResponse(**status.as_dict())


@router.get("/{segment_key}/students", response_model=SegmentStudentsResponse)
def get_segment_students(
    workspace_id: uuid.UUID,
    segment_key: str, 
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> SegmentStudentsResponse:
    try:
        result = get_segment_students_preference_status(db, segment_key, workspace_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return SegmentStudentsResponse(
        segment_key=result.segment_key,
        room_size=result.room_size,
        students=[
            {
                "admission_number": row.admission_number,
                "full_name": row.full_name,
                "has_valid_preferences": row.has_valid_preferences,
                "preference_status": row.preference_status,
            }
            for row in result.students
        ],
    )
