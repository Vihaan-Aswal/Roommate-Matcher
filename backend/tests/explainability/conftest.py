from __future__ import annotations

from itertools import combinations

from app.services.scoring.constants import FACTOR_BASE_WEIGHTS, SCORING_FACTOR_KEYS
from app.services.scoring.types import FactorScore, PairResult


def canonical_key(student_a: str, student_b: str) -> tuple[str, str]:
    return (student_a, student_b) if student_a < student_b else (student_b, student_a)


def _normalized_weights(missing_factors: set[str]) -> dict[str, float]:
    active_keys = [factor_key for factor_key in SCORING_FACTOR_KEYS if factor_key not in missing_factors]
    if not active_keys:
        return {factor_key: 0.0 for factor_key in SCORING_FACTOR_KEYS}

    active_weight_total = sum(FACTOR_BASE_WEIGHTS[factor_key] for factor_key in active_keys)
    return {
        factor_key: (
            FACTOR_BASE_WEIGHTS[factor_key] / active_weight_total if factor_key in active_keys else 0.0
        )
        for factor_key in SCORING_FACTOR_KEYS
    }


def build_pair_results(
    student_ids: list[str],
    *,
    default_factor_score: float = 0.5,
    pair_factor_overrides: dict[tuple[str, str], dict[str, float]] | None = None,
    pair_missing_overrides: dict[tuple[str, str], set[str]] | None = None,
    pair_score_overrides: dict[tuple[str, str], float] | None = None,
) -> dict[tuple[str, str], PairResult]:
    normalized_factor_overrides = {
        canonical_key(student_a, student_b): factor_override
        for (student_a, student_b), factor_override in (pair_factor_overrides or {}).items()
    }
    normalized_missing = {
        canonical_key(student_a, student_b): set(missing_keys)
        for (student_a, student_b), missing_keys in (pair_missing_overrides or {}).items()
    }
    normalized_pair_scores = {
        canonical_key(student_a, student_b): score
        for (student_a, student_b), score in (pair_score_overrides or {}).items()
    }

    pair_results: dict[tuple[str, str], PairResult] = {}

    for student_a, student_b in combinations(sorted(student_ids), 2):
        pair_key = canonical_key(student_a, student_b)
        factor_overrides = normalized_factor_overrides.get(pair_key, {})
        missing_factors = normalized_missing.get(pair_key, set())

        weights = _normalized_weights(missing_factors)
        factor_breakdown: dict[str, FactorScore] = {}
        for factor_key in SCORING_FACTOR_KEYS:
            raw_score = factor_overrides.get(factor_key, default_factor_score)
            factor_breakdown[factor_key] = FactorScore(
                raw_score=raw_score,
                weight_used=weights[factor_key],
                missing_data=factor_key in missing_factors,
            )

        if pair_key in normalized_pair_scores:
            pair_score = normalized_pair_scores[pair_key]
        else:
            pair_score = sum(
                factor.raw_score * factor.weight_used
                for factor in factor_breakdown.values()
                if not factor.missing_data
            )

        pair_results[pair_key] = PairResult(
            pair_score=pair_score,
            factor_breakdown=factor_breakdown,
            excellent_candidate=pair_score >= 0.90,
        )

    return pair_results
