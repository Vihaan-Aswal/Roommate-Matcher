from math import isclose

from app.services.scoring.constants import (
    ALCOHOL_DIET_MATRIX,
    DISTANCE_LOOKUPS,
    FACTOR_BASE_WEIGHTS,
    HEAVY_FACTORS,
    NEUTRAL_MIDPOINTS,
    PROFILE_FIELD_KEYS,
    SCORING_FACTOR_KEYS,
    SMOKING_MATRIX,
)


def test_weights_sum_to_one() -> None:
    assert isclose(sum(FACTOR_BASE_WEIGHTS.values()), 1.0, rel_tol=0.0, abs_tol=1e-12)


def test_weight_keys_match_scoring_keys() -> None:
    assert set(FACTOR_BASE_WEIGHTS) == set(SCORING_FACTOR_KEYS)


def test_heavy_factors_are_weighted() -> None:
    assert HEAVY_FACTORS.issubset(FACTOR_BASE_WEIGHTS)


def test_neutral_midpoints_cover_all_profile_fields() -> None:
    assert set(NEUTRAL_MIDPOINTS) == set(PROFILE_FIELD_KEYS)


def test_distance_lookup_shapes() -> None:
    assert DISTANCE_LOOKUPS["q1_enc"] == {0: 1.0, 1: 0.6, 2: 0.2, 3: 0.0}
    assert DISTANCE_LOOKUPS["q2_enc"] == {0: 1.0, 1: 0.5, 2: 0.0}
    assert DISTANCE_LOOKUPS["q3_enc"] == {0: 1.0, 1: 0.6, 2: 0.2}
    assert DISTANCE_LOOKUPS["q9_enc"] == {0: 1.0, 1: 0.7, 2: 0.3}


def test_matrix_divergence_between_smoking_and_diet_alcohol() -> None:
    assert SMOKING_MATRIX[2.0][3.0] == 0.5
    assert ALCOHOL_DIET_MATRIX[2.0][3.0] == 0.7


def test_matrix_shapes_are_complete() -> None:
    expected = {1.0, 2.0, 3.0}

    assert set(SMOKING_MATRIX) == expected
    assert set(ALCOHOL_DIET_MATRIX) == expected

    for matrix in (SMOKING_MATRIX, ALCOHOL_DIET_MATRIX):
        for row in matrix.values():
            assert set(row) == expected
