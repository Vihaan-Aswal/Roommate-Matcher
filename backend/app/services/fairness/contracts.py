from __future__ import annotations

from dataclasses import dataclass

LABEL_ORDER: tuple[str, ...] = ("Excellent", "Good", "Okay", "Poor")


@dataclass(frozen=True)
class FairnessLabelStats:
    label: str
    count: int
    percentage: float


@dataclass(frozen=True)
class SegmentFairnessSummary:
    segment_key: str
    total_students: int
    label_counts: dict[str, int]
    label_percentages: dict[str, float]
    at_risk_count: int
    at_risk_student_ids: list[str]
    minimum_satisfaction: float


@dataclass(frozen=True)
class FairnessReport:
    total_students: int
    run_label_counts: dict[str, int]
    run_label_percentages: dict[str, float]
    run_at_risk_count: int
    run_at_risk_student_ids: list[str]
    by_segment: list[SegmentFairnessSummary]
