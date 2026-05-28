from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import require_workspace_access
from app.models.tenant import Tenant
from app.auth.contracts import AuthenticatedUser
from app.models.workspace import Workspace
import uuid

from app.schemas.fairness import FairnessReportResponse
from app.services.orchestration.run_workflow import get_run_fairness_snapshot


from app.api.deps.run_access import resolve_run_or_403

router = APIRouter(prefix="/api/workspaces/{workspace_id}/fairness", tags=["fairness"])

@router.get("/{run_id}", response_model=FairnessReportResponse)
def get_fairness_report(
    workspace_id: uuid.UUID,
    run_id: str,
    db: Session = Depends(get_db),
    workspace_ctx: tuple[AuthenticatedUser, Tenant, Workspace] = Depends(require_workspace_access),
) -> FairnessReportResponse:
    resolve_run_or_403(db, workspace_id, run_id)
    try:
        snapshot = get_run_fairness_snapshot(db, run_id, workspace_id)
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
