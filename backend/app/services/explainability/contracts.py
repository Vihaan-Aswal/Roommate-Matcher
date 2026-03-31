from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.services.matching.contracts import SatisfactionLabel
from app.services.scoring.types import PairResult

ReasonMode = Literal["assigned_room", "hypothetical_group"]
ClaimScope = Literal["room_shared_claim", "student_specific_claim"]
FactorClass = Literal[
    "Strong Match",
    "Moderate Match",
    "Neutral",
    "Moderate Mismatch",
    "Strong Mismatch",
]

PairBreakdownIndex = dict[tuple[str, str], PairResult]


@dataclass(frozen=True)
class ReasonTrace:
    factor_key: str
    factor_class: FactorClass
    reason_bucket: str
    polarity: str
    template_id: str
    claim_scope: ClaimScope

    def to_dict(self) -> dict[str, str]:
        return {
            "factor_key": self.factor_key,
            "factor_class": self.factor_class,
            "reason_bucket": self.reason_bucket,
            "polarity": self.polarity,
            "template_id": self.template_id,
            "claim_scope": self.claim_scope,
        }


@dataclass(frozen=True)
class RoomExplanationContext:
    segment_key: str
    room_id: str
    room_size: int
    student_ids: list[str]
    pair_results: PairBreakdownIndex
    student_satisfaction: dict[str, float]
    student_labels: dict[str, SatisfactionLabel]
    student_at_risk: dict[str, bool]
    reason_mode: ReasonMode


@dataclass(frozen=True)
class StudentExplanation:
    student_id: str
    room_id: str
    satisfaction_label: SatisfactionLabel
    is_at_risk: bool
    reasons: list[str]
    factor_trace: list[dict[str, str]]


@dataclass(frozen=True)
class HypotheticalGroupInput:
    segment_key: str
    room_size: int
    student_ids: list[str]
    pair_results: PairBreakdownIndex
    precomputed_satisfaction: dict[str, float] | None = None
    precomputed_labels: dict[str, SatisfactionLabel] | None = None
