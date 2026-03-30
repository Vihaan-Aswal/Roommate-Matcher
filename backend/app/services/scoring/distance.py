from __future__ import annotations

from app.services.scoring.constants import DISTANCE_LOOKUPS


def score_distance_factor(factor_key: str, value_a: float, value_b: float) -> float:
    lookup = DISTANCE_LOOKUPS.get(factor_key)
    if lookup is None:
        raise ValueError(f"Unsupported distance factor: {factor_key}")

    distance = abs(value_a - value_b)
    if int(distance) != distance:
        raise ValueError(f"Distance for {factor_key} must be an integer, got {distance}")

    score = lookup.get(int(distance))
    if score is None:
        raise ValueError(f"Unsupported distance {distance} for {factor_key}")

    return score


def score_q1_sleep(value_a: float, value_b: float) -> float:
    return score_distance_factor("q1_enc", value_a, value_b)


def score_q2_cleanliness(value_a: float, value_b: float) -> float:
    return score_distance_factor("q2_enc", value_a, value_b)


def score_q3_late_return(value_a: float, value_b: float) -> float:
    return score_distance_factor("q3_enc", value_a, value_b)


def score_q9_budget(value_a: float, value_b: float) -> float:
    return score_distance_factor("q9_enc", value_a, value_b)
