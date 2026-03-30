from math import isclose

import pytest

from app.services.scoring import constants as scoring_constants
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


def test_validate_matrix_shape_rejects_invalid_rows() -> None:
    bad_matrix = {
        1.0: {1.0: 1.0, 2.0: 0.5, 3.0: 0.0},
        2.0: {1.0: 0.5, 2.0: 1.0, 3.0: 0.5},
    }

    with pytest.raises(ValueError, match="Matrix rows"):
        scoring_constants._validate_matrix_shape(bad_matrix)


def test_validate_matrix_shape_rejects_invalid_columns() -> None:
    bad_matrix = {
        1.0: {1.0: 1.0, 2.0: 0.5},
        2.0: {1.0: 0.5, 2.0: 1.0, 3.0: 0.5},
        3.0: {1.0: 0.0, 2.0: 0.5, 3.0: 1.0},
    }

    with pytest.raises(ValueError, match="Matrix columns"):
        scoring_constants._validate_matrix_shape(bad_matrix)


def test_validate_constants_rejects_weight_key_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(scoring_constants, "FACTOR_BASE_WEIGHTS", {"q1_enc": 1.0})

    with pytest.raises(ValueError, match="Weight keys"):
        scoring_constants._validate_constants()


def test_validate_constants_rejects_bad_weight_sum(monkeypatch: pytest.MonkeyPatch) -> None:
    bad_weights = dict(scoring_constants.FACTOR_BASE_WEIGHTS)
    bad_weights["q1_enc"] = 0.21
    monkeypatch.setattr(scoring_constants, "FACTOR_BASE_WEIGHTS", bad_weights)

    with pytest.raises(ValueError, match="sum to 1.0"):
        scoring_constants._validate_constants()


def test_validate_constants_rejects_heavy_factor_outside_weights(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(scoring_constants, "HEAVY_FACTORS", frozenset({"q1_enc", "q100_enc"}))

    with pytest.raises(ValueError, match="Heavy factors"):
        scoring_constants._validate_constants()


def test_validate_constants_rejects_midpoint_key_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(scoring_constants, "NEUTRAL_MIDPOINTS", {"q1_enc": 2.5})

    with pytest.raises(ValueError, match="Neutral midpoint keys"):
        scoring_constants._validate_constants()
