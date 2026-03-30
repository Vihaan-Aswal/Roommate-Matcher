from app.services.scoring.constants import SCORING_FACTOR_KEYS
from app.services.scoring.labels import is_excellent_candidate
from app.services.scoring.types import FactorScore


def _baseline_breakdown() -> dict[str, FactorScore]:
    return {
        key: FactorScore(raw_score=1.0, weight_used=0.1, missing_data=False)
        for key in SCORING_FACTOR_KEYS
    }


def test_excellent_candidate_requires_score_threshold() -> None:
    assert is_excellent_candidate(0.89, _baseline_breakdown()) is False


def test_excellent_candidate_accepts_strong_clean_match() -> None:
    assert is_excellent_candidate(0.90, _baseline_breakdown()) is True


def test_excellent_candidate_rejects_heavy_factor_zero_score() -> None:
    breakdown = _baseline_breakdown()
    breakdown["q6_enc"] = FactorScore(raw_score=0.0, weight_used=0.15, missing_data=False)

    assert is_excellent_candidate(0.95, breakdown) is False


def test_excellent_candidate_rejects_missing_heavy_factor() -> None:
    breakdown = _baseline_breakdown()
    breakdown["q1_enc"] = FactorScore(raw_score=1.0, weight_used=0.2, missing_data=True)

    assert is_excellent_candidate(0.95, breakdown) is False
