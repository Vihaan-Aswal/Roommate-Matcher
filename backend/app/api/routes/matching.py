from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.matching import (
    MatchingRunListResponse,
    MatchingRunRequest,
    MatchingRunResponse,
    MatchingRunRoomsResponse,
    MatchingRunStudentsResponse,
)
from app.services.matching.run_workflow import (
    get_run_rooms_from_persisted_artifacts,
    get_run_students_from_persisted_artifacts,
    list_matching_runs,
    run_matching_workflow,
)


router = APIRouter(prefix="/matching", tags=["matching"])


@router.post("/run", response_model=MatchingRunResponse)
def run_matching(payload: MatchingRunRequest, db: Session = Depends(get_db)) -> MatchingRunResponse:
    try:
        result = run_matching_workflow(db, payload.scope, payload.segment_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return MatchingRunResponse(
        run_id=result.run_id,
        scope=result.scope,
        status=result.status,
        message=result.message,
        segments_matched=result.segments_matched,
    )


@router.get("/runs", response_model=MatchingRunListResponse)
def get_matching_runs(db: Session = Depends(get_db)) -> MatchingRunListResponse:
    runs = list_matching_runs(db)
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


@router.get("/runs/{run_id}/segments/{segment_key}/rooms", response_model=MatchingRunRoomsResponse)
def get_matching_run_rooms(
    run_id: str,
    segment_key: str,
    db: Session = Depends(get_db),
) -> MatchingRunRoomsResponse:
    try:
        rooms = get_run_rooms_from_persisted_artifacts(db, run_id=run_id, segment_key=segment_key)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return MatchingRunRoomsResponse(run_id=run_id, segment_key=segment_key, rooms=rooms)


@router.get("/runs/{run_id}/segments/{segment_key}/students", response_model=MatchingRunStudentsResponse)
def get_matching_run_students(
    run_id: str,
    segment_key: str,
    db: Session = Depends(get_db),
) -> MatchingRunStudentsResponse:
    try:
        students = get_run_students_from_persisted_artifacts(db, run_id=run_id, segment_key=segment_key)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return MatchingRunStudentsResponse(run_id=run_id, segment_key=segment_key, students=students)
