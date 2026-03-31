from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.services.scoring.types import PairResult

SatisfactionLabel = Literal["Excellent", "Good", "Okay", "Poor"]


@dataclass(frozen=True)
class SegmentData:
    segment_key: str
    room_size: int
    student_ids: list[str]
    pair_results: dict[tuple[str, str], PairResult]
    room_ids: list[str] | None = None
    metadata: dict[str, str] | None = None


@dataclass(frozen=True)
class RoomAssignmentResult:
    room_id: str
    segment_key: str
    room_size: int
    student_ids: list[str]
    group_score: float
    needs_review: bool


@dataclass(frozen=True)
class StudentSatisfactionRecord:
    student_id: str
    room_id: str
    roommate_ids: list[str]
    satisfaction_score: float
    satisfaction_label: SatisfactionLabel
    excellent_safety_passed: bool
    is_at_risk: bool


@dataclass(frozen=True)
class RoomMetricRecord:
    room_id: str
    group_score: float
    min_student_satisfaction: float
    poor_count: int


@dataclass(frozen=True)
class MatchingResult:
    segment_key: str
    room_size: int
    rooms: list[RoomAssignmentResult]
    students: list[StudentSatisfactionRecord]
    room_metrics: list[RoomMetricRecord]
    at_risk_student_ids: list[str]
    label_counts: dict[str, int]
    swap_passes_applied: int
    minimum_satisfaction: float
