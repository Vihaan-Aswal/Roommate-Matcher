from __future__ import annotations

from math import isclose

SCORING_FACTOR_KEYS: tuple[str, ...] = (
    "q1_enc",
    "q2_enc",
    "q3_enc",
    "q4a_enc",
    "q5a_enc",
    "q6_enc",
    "q7_enc",
    "q8_enc",
    "q9_enc",
    "q10_enc",
)

PROFILE_FIELD_KEYS: tuple[str, ...] = (
    "q1_enc",
    "q2_enc",
    "q3_enc",
    "q4a_enc",
    "q4b_enc",
    "q5a_enc",
    "q5b_enc",
    "q6_enc",
    "q7_enc",
    "q8_enc",
    "q9_enc",
    "q10_enc",
)

FACTOR_BASE_WEIGHTS: dict[str, float] = {
    "q1_enc": 0.20,
    "q2_enc": 0.15,
    "q3_enc": 0.10,
    "q4a_enc": 0.10,
    "q5a_enc": 0.10,
    "q6_enc": 0.15,
    "q7_enc": 0.05,
    "q8_enc": 0.05,
    "q9_enc": 0.05,
    "q10_enc": 0.05,
}

HEAVY_FACTORS: frozenset[str] = frozenset({"q1_enc", "q2_enc", "q4a_enc", "q5a_enc", "q6_enc"})
EXCELLENT_THRESHOLD: float = 0.90

HABIT_COMFORT_AXES: dict[str, str] = {
    "q4a_enc": "q4b_enc",
    "q5a_enc": "q5b_enc",
}

DISTANCE_LOOKUPS: dict[str, dict[int, float]] = {
    "q1_enc": {0: 1.0, 1: 0.6, 2: 0.2, 3: 0.0},
    "q2_enc": {0: 1.0, 1: 0.5, 2: 0.0},
    "q3_enc": {0: 1.0, 1: 0.6, 2: 0.2},
    "q9_enc": {0: 1.0, 1: 0.7, 2: 0.3},
}

SMOKING_MATRIX: dict[float, dict[float, float]] = {
    1.0: {1.0: 1.0, 2.0: 0.6, 3.0: 0.0},
    2.0: {1.0: 0.6, 2.0: 1.0, 3.0: 0.5},
    3.0: {1.0: 0.0, 2.0: 0.5, 3.0: 1.0},
}

ALCOHOL_DIET_MATRIX: dict[float, dict[float, float]] = {
    1.0: {1.0: 1.0, 2.0: 0.7, 3.0: 0.0},
    2.0: {1.0: 0.7, 2.0: 1.0, 3.0: 0.7},
    3.0: {1.0: 0.0, 2.0: 0.7, 3.0: 1.0},
}

NEUTRAL_MIDPOINTS: dict[str, float] = {
    "q1_enc": 2.5,
    "q2_enc": 2.0,
    "q3_enc": 2.0,
    "q4a_enc": 1.0,
    "q4b_enc": 1.5,
    "q5a_enc": 1.0,
    "q5b_enc": 1.5,
    "q6_enc": 2.0,
    "q7_enc": 2.0,
    "q8_enc": 2.0,
    "q9_enc": 2.0,
    "q10_enc": 1.5,
}

HABIT_NORMALIZATION_DENOMINATOR: float = 2.0
COMFORT_NORMALIZATION_DENOMINATOR: float = 3.0
LIFESTYLE_NORMALIZATION_DENOMINATOR: float = 3.0


def _validate_matrix_shape(matrix: dict[float, dict[float, float]]) -> None:
    expected = {1.0, 2.0, 3.0}
    if set(matrix) != expected:
        raise ValueError("Matrix rows must exactly match 1.0, 2.0, 3.0")
    for row_value, row in matrix.items():
        if set(row) != expected:
            raise ValueError(f"Matrix columns for {row_value} must exactly match 1.0, 2.0, 3.0")


def _validate_constants() -> None:
    if set(FACTOR_BASE_WEIGHTS) != set(SCORING_FACTOR_KEYS):
        raise ValueError("Weight keys must match scoring factor keys")

    if not isclose(sum(FACTOR_BASE_WEIGHTS.values()), 1.0, rel_tol=0.0, abs_tol=1e-12):
        raise ValueError("Base factor weights must sum to 1.0")

    if not HEAVY_FACTORS.issubset(FACTOR_BASE_WEIGHTS):
        raise ValueError("Heavy factors must be a subset of weighted factors")

    if set(NEUTRAL_MIDPOINTS) != set(PROFILE_FIELD_KEYS):
        raise ValueError("Neutral midpoint keys must match profile keys")

    _validate_matrix_shape(SMOKING_MATRIX)
    _validate_matrix_shape(ALCOHOL_DIET_MATRIX)


_validate_constants()
