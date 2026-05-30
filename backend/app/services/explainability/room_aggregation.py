from __future__ import annotations

from dataclasses import dataclass

from app.services.explainability.factor_classification import ClassifiedFactor, classify_factor
from app.services.matching.pair_lookup import canonical_pair
from app.services.scoring.constants import FACTOR_BASE_WEIGHTS, SCORING_FACTOR_KEYS
from app.services.scoring.types import PairResult


@dataclass(frozen=True)
class AggregatedFactorEvidence:
    factor_key: str
    aggregated_raw_score: float
    coverage_count: int
    aggregated_missing_data: bool
    classified: ClassifiedFactor


def _validate_pair_factor_keys(pair_key: tuple[str, str], pair_result: PairResult) -> None:
    expected = set(SCORING_FACTOR_KEYS)
    provided = set(pair_result.factor_breakdown)
    if provided != expected:
        missing = sorted(expected.difference(provided))
        extra = sorted(provided.difference(expected))
        raise ValueError(
            f"Invalid factor breakdown keys for pair {pair_key}: missing={missing} extra={extra}"
        )


def _get_pair_result(
    pair_results: dict[tuple[str, str], PairResult],
    student_id: str,
    roommate_id: str,
) -> PairResult:
    pair_key = canonical_pair(student_id, roommate_id)
    pair_result = pair_results.get(pair_key)
    if pair_result is None:
        raise ValueError(f"Missing pair result for pair {pair_key}")
    _validate_pair_factor_keys(pair_key, pair_result)
    return pair_result


def aggregate_student_factors(
    *,
    student_id: str,
    room_student_ids: list[str],
    pair_results: dict[tuple[str, str], PairResult],
) -> list[AggregatedFactorEvidence]:
    if student_id not in room_student_ids:
        raise ValueError(f"student_id {student_id} is not in room_student_ids")

    roommates = [roommate for roommate in sorted(room_student_ids) if roommate != student_id]
    aggregated: list[AggregatedFactorEvidence] = []

    for factor_key in SCORING_FACTOR_KEYS:
        observed_scores: list[float] = []
        for roommate_id in roommates:
            pair_result = _get_pair_result(pair_results, student_id, roommate_id)
            factor = pair_result.factor_breakdown[factor_key]
            if factor.missing_data:
                continue
            observed_scores.append(factor.raw_score)

        if observed_scores:
            aggregated_raw_score = sum(observed_scores) / len(observed_scores)
            aggregated_missing_data = False
        else:
            aggregated_raw_score = 0.50
            aggregated_missing_data = True

        classified = classify_factor(
            factor_key=factor_key,
            raw_score=aggregated_raw_score,
            weight_used=FACTOR_BASE_WEIGHTS[factor_key],
            missing_data=aggregated_missing_data,
        )

        aggregated.append(
            AggregatedFactorEvidence(
                factor_key=factor_key,
                aggregated_raw_score=aggregated_raw_score,
                coverage_count=len(observed_scores),
                aggregated_missing_data=aggregated_missing_data,
                classified=classified,
            )
        )

    return aggregated


