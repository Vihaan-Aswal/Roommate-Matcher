from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class FactorScore:
    raw_score: float
    weight_used: float
    missing_data: bool


@dataclass(frozen=True)
class PairResult:
    pair_score: float
    factor_breakdown: dict[str, FactorScore]
    excellent_candidate: bool


@dataclass(frozen=True)
class ScoringProfile:
    admission_number: str
    has_preferences: bool
    q1_enc: float | None
    q2_enc: float | None
    q3_enc: float | None
    q4a_enc: float | None
    q4b_enc: float | None
    q5a_enc: float | None
    q5b_enc: float | None
    q6_enc: float | None
    q7_enc: float | None
    q8_enc: float | None
    q9_enc: float | None
    q10_enc: float | None
