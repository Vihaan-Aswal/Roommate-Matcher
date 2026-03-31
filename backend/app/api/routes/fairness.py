from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.fairness import FairnessReportResponse
from app.services.matching.run_workflow import get_run_fairness_snapshot


router = APIRouter(prefix="/fairness", tags=["fairness"])


@router.get("/{run_id}", response_model=FairnessReportResponse)
def get_fairness_report(run_id: str, db: Session = Depends(get_db)) -> FairnessReportResponse:
    try:
        snapshot = get_run_fairness_snapshot(db, run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return FairnessReportResponse(
        run_id=run_id,
        total_students=int(snapshot.get("total_students", 0)),
        run_label_counts=dict(snapshot.get("run_label_counts", {})),
        run_label_percentages=dict(snapshot.get("run_label_percentages", {})),
        run_at_risk_count=int(snapshot.get("run_at_risk_count", 0)),
        run_at_risk_student_ids=list(snapshot.get("run_at_risk_student_ids", [])),
        by_segment=list(snapshot.get("by_segment", [])),
    )
