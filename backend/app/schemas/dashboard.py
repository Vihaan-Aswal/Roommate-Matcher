from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class DashboardSetupStatus(BaseModel):
    master_students_uploaded: bool
    rooms_uploaded: bool
    forms_collection_started: bool
    at_least_one_segment_ready: bool


class DashboardFormCollectionStats(BaseModel):
    total_students: int
    students_with_valid_preferences: int
    percentage_complete: float


class DashboardSegmentsStatus(BaseModel):
    total_segments: int
    ready: int
    impossible: int
    at_risk: int


class DashboardLatestRun(BaseModel):
    run_id: str | None
    status: str | None
    created_at: datetime | None


class DashboardResponse(BaseModel):
    setup_status: DashboardSetupStatus
    form_collection_stats: DashboardFormCollectionStats
    segments_status: DashboardSegmentsStatus
    latest_matching_run: DashboardLatestRun
