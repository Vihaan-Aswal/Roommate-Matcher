from __future__ import annotations

import threading
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, exists
from app.models.preference_profile import PreferenceProfile

from app.auth.dependencies import require_workspace_access, require_workspace_editor
from app.models.tenant import Tenant
from app.auth.contracts import AuthenticatedUser
from app.models.workspace import Workspace
import uuid
from app.database import get_db
from app.schemas.matching import (
    MatchingRunListResponse,
    MatchingRunRequest,
    MatchingRunResponse,
    MatchingRunRoomsResponse,
    MatchingRunStudentsResponse,
)
from app.services.orchestration import run_queue
from app.services.orchestration.run_workflow import (
    create_matching_run,
    get_run_rooms_from_persisted_artifacts,
    get_run_students_from_persisted_artifacts,
    has_running_run,
    list_matching_runs,
)

from app.api.deps.run_access import resolve_run_or_403

router = APIRouter(prefix="/api/workspaces/{workspace_id}/matching", tags=["matching"])

_RUN_LOCK = threading.Lock()


@router.post("/runs", response_model=MatchingRunResponse)
def run_matching(
    workspace_id: uuid.UUID,
    payload: MatchingRunRequest,
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_editor),
) -> MatchingRunResponse:
    try:
        with _RUN_LOCK:
            if has_running_run(db, workspace_id):
                raise HTTPException(
                    status_code=409,
                    detail="A matching run is already in progress for this workspace.",
                )
            run_row, targets = create_matching_run(
                db, workspace_id, payload.scope, payload.segment_key
            )
            run_queue.enqueue_matching_run(
                run_row.id,
                run_row.run_id,
                [target.id for target in targets],
                workspace_id,
                payload.scope,
            )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    db.refresh(run_row)
    if run_row.status == "completed":
        message = "Matching run completed successfully."
    elif run_row.status == "failed":
        message = run_row.error_message or "Matching run failed."
    else:
        message = "Matching run started."

    return MatchingRunResponse(
        run_id=run_row.run_id,
        scope=payload.scope,
        status=run_row.status,
        message=message,
        segments_matched=len(targets),
    )


@router.get("/runs", response_model=MatchingRunListResponse)
def get_matching_runs(
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> MatchingRunListResponse:
    runs = list_matching_runs(db, workspace_id)
    progress = run_queue.progress_snapshot()
    return MatchingRunListResponse(
        runs=[
            {
                "run_id": run.run_id,
                "created_at": run.created_at,
                "started_at": run.started_at,
                "finished_at": run.finished_at,
                "status": run.status,
                "scope": run.scope,
                "segments_completed": (
                    progress[run.run_id][0]
                    if run.status == "running" and run.run_id in progress
                    else run.segments_completed
                ),
                "error_message": run.error_message,
            }
            for run in runs
        ]
    )


from fastapi import Query

@router.get("/runs/{run_id}/rooms", response_model=MatchingRunRoomsResponse)
def get_matching_run_rooms(
    workspace_id: uuid.UUID,
    run_id: str,
    segment_key: str = Query(...),
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> MatchingRunRoomsResponse:
    resolve_run_or_403(db, workspace_id, run_id)
    try:
        rooms = get_run_rooms_from_persisted_artifacts(db, run_id=run_id, segment_key=segment_key, workspace_id=workspace_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    has_generated = bool(db.scalar(
        select(
            exists(
                select(PreferenceProfile.id).where(
                    PreferenceProfile.workspace_id == workspace_id,
                    PreferenceProfile.is_active == True,
                    PreferenceProfile.is_generated == True,
                )
            )
        )
    ))
    return MatchingRunRoomsResponse(run_id=run_id, segment_key=segment_key, rooms=rooms, has_generated_profiles=has_generated)


@router.get("/runs/{run_id}/students", response_model=MatchingRunStudentsResponse)
def get_matching_run_students(
    workspace_id: uuid.UUID,
    run_id: str,
    segment_key: str = Query(...),
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> MatchingRunStudentsResponse:
    resolve_run_or_403(db, workspace_id, run_id)
    try:
        students = get_run_students_from_persisted_artifacts(db, run_id=run_id, segment_key=segment_key, workspace_id=workspace_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    has_generated = bool(db.scalar(
        select(
            exists(
                select(PreferenceProfile.id).where(
                    PreferenceProfile.workspace_id == workspace_id,
                    PreferenceProfile.is_active == True,
                    PreferenceProfile.is_generated == True,
                )
            )
        )
    ))
    return MatchingRunStudentsResponse(run_id=run_id, segment_key=segment_key, students=students, has_generated_profiles=has_generated)


@router.get("/runs/{run_id}/students/all-segments")
def get_all_segments_students(
    workspace_id: uuid.UUID,
    run_id: str,
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
):
    run = resolve_run_or_403(db, workspace_id, run_id)
    
    # Get all assignments for this run
    from app.models.room_assignment import RoomAssignment
    from app.models.segment import Segment
    from sqlalchemy import select
    import json
    
    # We just need to know which segments are part of the run
    # and then call get_run_students_from_persisted_artifacts for each
    segments = db.scalars(
        select(Segment)
        .join(RoomAssignment, RoomAssignment.segment_id == Segment.id)
        .where(RoomAssignment.matching_run_id == run.id)
        .distinct()
        .order_by(Segment.segment_key)
    ).all()
    
    segments_payload = []
    for segment in segments:
        students = get_run_students_from_persisted_artifacts(
            db, run_id=run_id, segment_key=segment.segment_key, workspace_id=workspace_id
        )
        segments_payload.append({
            "segment_key": segment.segment_key,
            "students": students,
        })
        
    return {"segments": segments_payload}
