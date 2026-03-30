from math import isclose

from app.services.scoring.constants import SCORING_FACTOR_KEYS
from app.services.scoring.pipeline import compute_pair_score
from app.services.scoring.types import ScoringProfile


def _scoring_profile(
    admission_number: str,
    *,
    q1: float | None = 1.0,
    q2: float | None = 1.0,
    q3: float | None = 1.0,
    q4a: float | None = 0.0,
    q4b: float | None = 3.0,
    q5a: float | None = 0.0,
    q5b: float | None = 3.0,
    q6: float | None = 1.0,
    q7: float | None = 1.0,
    q8: float | None = 1.0,
    q9: float | None = 1.0,
    q10: float | None = 0.0,
) -> ScoringProfile:
    return ScoringProfile(
        admission_number=admission_number,
        has_preferences=True,
        q1_enc=q1,
        q2_enc=q2,
        q3_enc=q3,
        q4a_enc=q4a,
        q4b_enc=q4b,
        q5a_enc=q5a,
        q5b_enc=q5b,
        q6_enc=q6,
        q7_enc=q7,
        q8_enc=q8,
        q9_enc=q9,
        q10_enc=q10,
    )


def test_identical_profiles_score_perfectly() -> None:
    profile_a = _scoring_profile("ADM001")
    profile_b = _scoring_profile("ADM002")

    result = compute_pair_score(profile_a, profile_b)

    assert result.pair_score == 1.0
    assert result.excellent_candidate is True
    assert set(result.factor_breakdown) == set(SCORING_FACTOR_KEYS)


def test_missing_factor_weight_is_renormalized() -> None:
    profile_a = _scoring_profile("ADM001")
    profile_b = _scoring_profile("ADM002", q9=None)

    result = compute_pair_score(profile_a, profile_b)

    assert result.factor_breakdown["q9_enc"].missing_data is True
    assert result.factor_breakdown["q9_enc"].weight_used == 0.0

    used_weight_sum = sum(item.weight_used for item in result.factor_breakdown.values())
    assert isclose(used_weight_sum, 1.0, rel_tol=0.0, abs_tol=1e-12)


def test_all_missing_profiles_return_zeroed_result() -> None:
    profile_a = _scoring_profile(
        "ADM001",
        q1=None,
        q2=None,
        q3=None,
        q4a=None,
        q4b=None,
        q5a=None,
        q5b=None,
        q6=None,
        q7=None,
        q8=None,
        q9=None,
        q10=None,
    )
    profile_b = _scoring_profile(
        "ADM002",
        q1=None,
        q2=None,
        q3=None,
        q4a=None,
        q4b=None,
        q5a=None,
        q5b=None,
        q6=None,
        q7=None,
        q8=None,
        q9=None,
        q10=None,
    )

    result = compute_pair_score(profile_a, profile_b)

    assert result.pair_score == 0.0
    assert result.excellent_candidate is False
    for factor_score in result.factor_breakdown.values():
        assert factor_score.weight_used == 0.0
        assert factor_score.missing_data is True


def test_missing_heavy_factor_vetoes_excellent_label() -> None:
    profile_a = _scoring_profile("ADM001", q6=None)
    profile_b = _scoring_profile("ADM002")

    result = compute_pair_score(profile_a, profile_b)

    assert result.pair_score > 0.90
    assert result.excellent_candidate is False
