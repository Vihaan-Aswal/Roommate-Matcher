from __future__ import annotations

from app.services.scoring.constants import ALCOHOL_DIET_MATRIX, SMOKING_MATRIX


def _matrix_score(matrix: dict[float, dict[float, float]], value_a: float, value_b: float) -> float:
    row = matrix.get(value_a)
    if row is None:
        raise ValueError(f"Unsupported matrix value: {value_a}")

    score = row.get(value_b)
    if score is None:
        raise ValueError(f"Unsupported matrix value: {value_b}")

    return score


def score_q6_smoking(value_a: float, value_b: float) -> float:
    return _matrix_score(SMOKING_MATRIX, value_a, value_b)


def score_q7_drinking(value_a: float, value_b: float) -> float:
    return _matrix_score(ALCOHOL_DIET_MATRIX, value_a, value_b)


def score_q8_diet(value_a: float, value_b: float) -> float:
    return _matrix_score(ALCOHOL_DIET_MATRIX, value_a, value_b)
