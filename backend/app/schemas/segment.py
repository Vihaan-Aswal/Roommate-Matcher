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


class SegmentOverviewResponse(BaseModel):
    segment_key: str
    gender: str
    year_group: str
    ac_type: str
    room_size: int
    status: str
    student_count: int
    total_capacity: int
    missing_preferences_count: int
    missing_preferences_ratio: float


class SegmentListResponse(BaseModel):
    segments: list[SegmentOverviewResponse]


class SegmentStudentPreferenceRowResponse(BaseModel):
    admission_number: str
    full_name: str
    has_valid_preferences: bool
    preference_status: str


class SegmentStudentsResponse(BaseModel):
    segment_key: str
    room_size: int
    students: list[SegmentStudentPreferenceRowResponse]
