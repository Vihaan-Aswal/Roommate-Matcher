from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import require_workspace_access
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
from app.services.orchestration.run_workflow import (
    get_run_rooms_from_persisted_artifacts,
    get_run_students_from_persisted_artifacts,
    list_matching_runs,
    run_matching_workflow,
)


router = APIRouter(prefix="/matching", tags=["matching"])


@router.post("/{workspace_id}/run", response_model=MatchingRunResponse)
def run_matching(
    workspace_id: uuid.UUID,
    payload: MatchingRunRequest,
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> MatchingRunResponse:
    try:
        result = run_matching_workflow(db, payload.scope, payload.segment_key, workspace_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return MatchingRunResponse(
        run_id=result.run_id,
        scope=result.scope,
        status=result.status,
        message=result.message,
        segments_matched=result.segments_matched,
    )


@router.get("/{workspace_id}/runs", response_model=MatchingRunListResponse)
def get_matching_runs(
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> MatchingRunListResponse:
    runs = list_matching_runs(db, workspace_id)
    return MatchingRunListResponse(
        runs=[
            {
                "run_id": run.run_id,
                "created_at": run.created_at,
                "started_at": run.started_at,
                "finished_at": run.finished_at,
                "status": run.status,
                "scope": run.scope,
                "segments_completed": run.segments_completed,
                "error_message": run.error_message,
            }
            for run in runs
        ]
    )


@router.get("/{workspace_id}/runs/{run_id}/segments/{segment_key}/rooms", response_model=MatchingRunRoomsResponse)
def get_matching_run_rooms(
    workspace_id: uuid.UUID,
    run_id: str,
    segment_key: str,
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> MatchingRunRoomsResponse:
    try:
        rooms = get_run_rooms_from_persisted_artifacts(db, run_id=run_id, segment_key=segment_key, workspace_id=workspace_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return MatchingRunRoomsResponse(run_id=run_id, segment_key=segment_key, rooms=rooms)


@router.get("/{workspace_id}/runs/{run_id}/segments/{segment_key}/students", response_model=MatchingRunStudentsResponse)
def get_matching_run_students(
    workspace_id: uuid.UUID,
    run_id: str,
    segment_key: str,
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> MatchingRunStudentsResponse:
    try:
        students = get_run_students_from_persisted_artifacts(db, run_id=run_id, segment_key=segment_key, workspace_id=workspace_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return MatchingRunStudentsResponse(run_id=run_id, segment_key=segment_key, students=students)
