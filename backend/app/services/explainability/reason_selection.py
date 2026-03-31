from __future__ import annotations

from dataclasses import dataclass
from functools import cmp_to_key
from typing import Literal

from app.services.explainability.factor_classification import ClassifiedFactor
from app.services.explainability.privacy_rules import SENSITIVE_FACTOR_KEYS
from app.services.scoring.constants import SCORING_FACTOR_KEYS

MAX_REASONS = 3
SCORE_EQUIVALENCE_DELTA = 0.02
LOW_SIGNAL_MODERATE_MIN = 0.65

ReasonPolarity = Literal["strong_positive", "moderate_positive", "mismatch", "neutral_context"]

FACTOR_REASON_BUCKETS: dict[str, str] = {
    "q1_enc": "sleep_alignment",
    "q2_enc": "cleanliness_alignment",
    "q3_enc": "late_return_alignment",
    "q4a_enc": "room_usage_alignment",
    "q5a_enc": "night_activity_alignment",
    "q6_enc": "sensitive_lifestyle",
    "q7_enc": "sensitive_lifestyle",
    "q8_enc": "sensitive_lifestyle",
    "q9_enc": "budget_alignment",
    "q10_enc": "lifestyle_tolerance",
}

FACTOR_INDEX = {factor_key: index for index, factor_key in enumerate(SCORING_FACTOR_KEYS)}


@dataclass(frozen=True)
class ReasonCandidate:
    factor_key: str
    reason_bucket: str
    factor_class: str
    polarity: ReasonPolarity
    raw_score: float
    weight_used: float
    claim_scope: str
    missing_data: bool


def _polarity_for_class(factor_class: str) -> ReasonPolarity:
    if factor_class == "Strong Match":
        return "strong_positive"
    if factor_class == "Moderate Match":
        return "moderate_positive"
    if factor_class in {"Moderate Mismatch", "Strong Mismatch"}:
        return "mismatch"
    return "neutral_context"


def _positive_priority(candidate: ReasonCandidate) -> int:
    if candidate.factor_class == "Strong Match":
        return 0
    if candidate.factor_class == "Moderate Match":
        return 1
    return 2


def _mismatch_priority(candidate: ReasonCandidate) -> int:
    if candidate.factor_class == "Strong Mismatch":
        return 0
    if candidate.factor_class == "Moderate Mismatch":
        return 1
    return 2


def _compare_positive(left: ReasonCandidate, right: ReasonCandidate) -> int:
    if _positive_priority(left) != _positive_priority(right):
        return -1 if _positive_priority(left) < _positive_priority(right) else 1

    if abs(left.raw_score - right.raw_score) > SCORE_EQUIVALENCE_DELTA:
        return -1 if left.raw_score > right.raw_score else 1

    if left.weight_used != right.weight_used:
        return -1 if left.weight_used > right.weight_used else 1

    left_index = FACTOR_INDEX.get(left.factor_key, len(FACTOR_INDEX))
    right_index = FACTOR_INDEX.get(right.factor_key, len(FACTOR_INDEX))
    if left_index != right_index:
        return -1 if left_index < right_index else 1

    return -1 if left.factor_key < right.factor_key else (1 if left.factor_key > right.factor_key else 0)


def _compare_mismatch(left: ReasonCandidate, right: ReasonCandidate) -> int:
    if _mismatch_priority(left) != _mismatch_priority(right):
        return -1 if _mismatch_priority(left) < _mismatch_priority(right) else 1

    if abs(left.raw_score - right.raw_score) > SCORE_EQUIVALENCE_DELTA:
        return -1 if left.raw_score < right.raw_score else 1

    if left.weight_used != right.weight_used:
        return -1 if left.weight_used > right.weight_used else 1

    left_index = FACTOR_INDEX.get(left.factor_key, len(FACTOR_INDEX))
    right_index = FACTOR_INDEX.get(right.factor_key, len(FACTOR_INDEX))
    if left_index != right_index:
        return -1 if left_index < right_index else 1

    return -1 if left.factor_key < right.factor_key else (1 if left.factor_key > right.factor_key else 0)


def _dedupe_buckets(candidates: list[ReasonCandidate]) -> list[ReasonCandidate]:
    deduped: list[ReasonCandidate] = []
    seen_buckets: set[str] = set()
    for candidate in candidates:
        if candidate.reason_bucket in seen_buckets:
            continue
        deduped.append(candidate)
        seen_buckets.add(candidate.reason_bucket)
    return deduped


def _neutral_context_fallback() -> ReasonCandidate:
    return ReasonCandidate(
        factor_key="_context",
        reason_bucket="neutral_context_room",
        factor_class="Neutral",
        polarity="neutral_context",
        raw_score=0.50,
        weight_used=0.0,
        claim_scope="room_shared_claim",
        missing_data=False,
    )


def build_reason_candidates(
    classified_factors: list[ClassifiedFactor],
    *,
    claim_scope: str = "student_specific_claim",
) -> list[ReasonCandidate]:
    candidates: list[ReasonCandidate] = []
    for classified in classified_factors:
        reason_bucket = FACTOR_REASON_BUCKETS[classified.factor_key]
        if classified.factor_key in SENSITIVE_FACTOR_KEYS:
            reason_bucket = "sensitive_lifestyle"
        candidates.append(
            ReasonCandidate(
                factor_key=classified.factor_key,
                reason_bucket=reason_bucket,
                factor_class=classified.factor_class,
                polarity=_polarity_for_class(classified.factor_class),
                raw_score=classified.raw_score,
                weight_used=classified.weight_used,
                claim_scope=claim_scope,
                missing_data=classified.missing_data,
            )
        )
    return candidates


def _partition_candidates(
    satisfaction_label: str,
    candidates: list[ReasonCandidate],
) -> tuple[list[ReasonCandidate], list[ReasonCandidate]]:
    positive: list[ReasonCandidate] = []
    mismatch: list[ReasonCandidate] = []

    for candidate in candidates:
        if candidate.missing_data:
            continue
        if candidate.factor_class == "Neutral":
            continue
        if (
            satisfaction_label in {"Excellent", "Good"}
            and candidate.factor_class == "Moderate Match"
            and candidate.raw_score < LOW_SIGNAL_MODERATE_MIN
        ):
            continue

        if candidate.factor_class in {"Strong Match", "Moderate Match"}:
            positive.append(candidate)
        elif candidate.factor_class in {"Strong Mismatch", "Moderate Mismatch"}:
            mismatch.append(candidate)

    sorted_positive = _dedupe_buckets(sorted(positive, key=cmp_to_key(_compare_positive)))
    sorted_mismatch = _dedupe_buckets(sorted(mismatch, key=cmp_to_key(_compare_mismatch)))
    return sorted_positive, sorted_mismatch


def select_reason_candidates(
    satisfaction_label: str,
    candidates: list[ReasonCandidate],
    *,
    max_reasons: int = MAX_REASONS,
) -> list[ReasonCandidate]:
    positive, mismatch = _partition_candidates(satisfaction_label, candidates)

    if satisfaction_label == "Excellent":
        return positive[:max_reasons]

    if satisfaction_label == "Good":
        selected = positive[:max_reasons]
        if len(selected) < 2 and mismatch and len(selected) < max_reasons:
            selected.append(mismatch[0])
        return selected[:max_reasons]

    if satisfaction_label == "Okay":
        selected: list[ReasonCandidate] = []
        selected.extend(positive[:2])
        if mismatch and len(selected) < max_reasons:
            selected.append(mismatch[0])
        if len(selected) < max_reasons and len(selected) < 2 and len(mismatch) > 1:
            selected.append(mismatch[1])
        return selected[:max_reasons]

    if satisfaction_label == "Poor":
        selected = positive[:1] + mismatch[:2]
        if not positive and len(selected) < max_reasons:
            selected.append(_neutral_context_fallback())
        return selected[:max_reasons]

    raise ValueError(f"Unsupported satisfaction label: {satisfaction_label}")
