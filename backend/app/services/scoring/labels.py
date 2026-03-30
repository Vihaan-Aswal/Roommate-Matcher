from __future__ import annotations

from app.services.scoring.constants import EXCELLENT_THRESHOLD, HEAVY_FACTORS
from app.services.scoring.types import FactorScore


def is_excellent_candidate(pair_score: float, factor_breakdown: dict[str, FactorScore]) -> bool:
    if pair_score < EXCELLENT_THRESHOLD:
        return False

    for factor_key in HEAVY_FACTORS:
        factor_score = factor_breakdown.get(factor_key)
        if factor_score is None:
            return False
        if factor_score.raw_score == 0.0:
            return False
        if factor_score.missing_data:
            return False

    return True
