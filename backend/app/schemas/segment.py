from __future__ import annotations

from pydantic import BaseModel


class SegmentStatusResponse(BaseModel):
    segment_key: str
    status: str
    reason: str
    student_count: int
    total_capacity: int
    missing_preferences_count: int
    missing_preferences_ratio: float
