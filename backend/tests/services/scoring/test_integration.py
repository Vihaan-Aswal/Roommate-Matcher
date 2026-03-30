from math import isclose

from app.services.scoring.pipeline import compute_pair_score
from app.services.scoring.types import ScoringProfile


def _profile(
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


def test_fixture_perfect_mirrors() -> None:
    profile_a = _profile("ADM001")
    profile_b = _profile("ADM002")

    result = compute_pair_score(profile_a, profile_b)

    assert result.pair_score == 1.0
    assert result.excellent_candidate is True


def test_fixture_mismatched_smoker() -> None:
    profile_a = _profile("ADM001", q6=1.0)
    profile_b = _profile("ADM002", q6=3.0)

    result = compute_pair_score(profile_a, profile_b)

    assert isclose(result.pair_score, 0.85, rel_tol=0.0, abs_tol=1e-12)
    assert result.factor_breakdown["q6_enc"].raw_score == 0.0
    assert result.excellent_candidate is False


def test_fixture_asymmetric_sleepers() -> None:
    profile_a = _profile("ADM001", q5a=2.0, q5b=3.0)
    profile_b = _profile("ADM002", q5a=0.0, q5b=0.0)

    result = compute_pair_score(profile_a, profile_b)

    assert result.factor_breakdown["q5a_enc"].raw_score == 0.5
    assert isclose(result.pair_score, 0.95, rel_tol=0.0, abs_tol=1e-12)


def test_fixture_ghost_profile() -> None:
    profile_a = _profile("ADM001")
    profile_b = _profile(
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


def test_fixture_matrix_divergence_proof() -> None:
    profile_a = _profile("ADM001", q6=2.0, q8=2.0)
    profile_b = _profile("ADM002", q6=3.0, q8=3.0)

    result = compute_pair_score(profile_a, profile_b)

    assert result.factor_breakdown["q6_enc"].raw_score == 0.5
    assert result.factor_breakdown["q8_enc"].raw_score == 0.7
