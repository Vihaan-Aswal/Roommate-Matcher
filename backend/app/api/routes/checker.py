from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.checker import CheckerRequest, CheckerResponse, CheckerStudentResult
from app.services.orchestration.checker_workflow import run_manual_checker


router = APIRouter(prefix="/checker", tags=["checker"])


@router.post("/compatibility", response_model=CheckerResponse)
def check_compatibility(payload: CheckerRequest, db: Session = Depends(get_db)) -> CheckerResponse:
    try:
        result = run_manual_checker(
            db,
            segment_key=payload.segment_key,
            room_size=payload.room_size,
            student_ids=payload.student_ids,
            precomputed_satisfaction=payload.precomputed_satisfaction,
            precomputed_labels=payload.precomputed_labels,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return CheckerResponse(
        group_score=result.group_score,
        group_label=result.group_label,
        at_risk_students=result.at_risk_students,
        students=[CheckerStudentResult(**row) for row in result.students],
    )
