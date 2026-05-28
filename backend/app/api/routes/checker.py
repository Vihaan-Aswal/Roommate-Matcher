from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import require_workspace_access
from app.models.tenant import Tenant
from app.auth.contracts import AuthenticatedUser
from app.models.workspace import Workspace
from app.models.student import Student
import uuid
from sqlalchemy import select

from app.schemas.checker import CheckerRequest, CheckerResponse, CheckerStudentResult
from app.services.orchestration.checker_workflow import run_manual_checker


router = APIRouter(prefix="/checker", tags=["checker"])


@router.post("/{workspace_id}/compatibility", response_model=CheckerResponse)
def check_compatibility(
    workspace_id: uuid.UUID,
    payload: CheckerRequest, 
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> CheckerResponse:
    students = db.scalars(select(Student).where(Student.workspace_id == workspace_id, Student.admission_number.in_(payload.student_ids))).all()
    if len(students) != len(payload.student_ids):
        raise HTTPException(status_code=404, detail="One or more students not found in this workspace")
    try:
        result = run_manual_checker(
            db,
            segment_key=payload.segment_key,
            workspace_id=workspace_id,
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
