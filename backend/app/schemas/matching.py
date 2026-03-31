from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, model_validator


class MatchingRunRequest(BaseModel):
    segment_key: str | None = None
    scope: Literal["segment", "all_ready_segments"]

    @model_validator(mode="after")
    def validate_scope_and_segment(self) -> "MatchingRunRequest":
        if self.scope == "segment" and not self.segment_key:
            raise ValueError("segment_key is required when scope is segment")
        if self.scope == "all_ready_segments" and self.segment_key is not None:
            raise ValueError("segment_key must be null when scope is all_ready_segments")
        return self


class MatchingRunResponse(BaseModel):
    run_id: str
    scope: Literal["segment", "all_ready_segments"]
    status: Literal["pending", "running", "completed", "failed"]
    message: str
    segments_matched: int


class MatchingRunHistoryRow(BaseModel):
    run_id: str
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    status: Literal["pending", "running", "completed", "failed"]
    scope: Literal["segment", "all_ready_segments"]
    segments_completed: int
    error_message: str | None


class MatchingRunListResponse(BaseModel):
    runs: list[MatchingRunHistoryRow]


class RoomViewStudentRow(BaseModel):
    admission_number: str
    full_name: str
    pair_scores_with_roommates: dict[str, float]


class RunRoomRow(BaseModel):
    room_id: str
    room_size: int
    assigned_students: list[RoomViewStudentRow]
    group_score: float
    needs_review: bool


class MatchingRunRoomsResponse(BaseModel):
    run_id: str
    segment_key: str
    rooms: list[RunRoomRow]


class RunStudentRow(BaseModel):
    admission_number: str
    full_name: str
    room_id: str
    roommate_ids: list[str]
    satisfaction_score: float
    satisfaction_label: Literal["Excellent", "Good", "Okay", "Poor"]
    is_at_risk: bool
    reasons: list[str]
    factor_trace: list[dict[str, str]]


class MatchingRunStudentsResponse(BaseModel):
    run_id: str
    segment_key: str
    students: list[RunStudentRow]
