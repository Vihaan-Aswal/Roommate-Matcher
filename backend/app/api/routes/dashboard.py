from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard.summary import get_dashboard_summary


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
def get_dashboard(db: Session = Depends(get_db)) -> DashboardResponse:
    summary = get_dashboard_summary(db)
    return DashboardResponse(
        setup_status=summary.setup_status,
        form_collection_stats=summary.form_collection_stats,
        segments_status=summary.segments_status,
        latest_matching_run=summary.latest_matching_run,
    )
