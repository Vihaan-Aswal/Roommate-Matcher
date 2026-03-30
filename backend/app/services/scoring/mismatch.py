from __future__ import annotations

from app.services.scoring.constants import (
    COMFORT_NORMALIZATION_DENOMINATOR,
    HABIT_NORMALIZATION_DENOMINATOR,
    LIFESTYLE_NORMALIZATION_DENOMINATOR,
)


def _ensure_range(value: float, minimum: float, maximum: float, label: str) -> None:
    if value < minimum or value > maximum:
        raise ValueError(f"{label} must be between {minimum} and {maximum}, got {value}")


def _normalize_habit(value: float) -> float:
    _ensure_range(value, 0.0, 2.0, "Habit value")
    return value / HABIT_NORMALIZATION_DENOMINATOR


def _normalize_comfort(value: float) -> float:
    _ensure_range(value, 0.0, 3.0, "Comfort value")
    return value / COMFORT_NORMALIZATION_DENOMINATOR


def _normalize_lifestyle_tolerance(value: float) -> float:
    _ensure_range(value, 0.0, 3.0, "Lifestyle tolerance value")
    return value / LIFESTYLE_NORMALIZATION_DENOMINATOR


def directional_mismatch(habit_value: float, comfort_value: float) -> float:
    habit_normalized = _normalize_habit(habit_value)
    comfort_normalized = _normalize_comfort(comfort_value)
    return max(0.0, habit_normalized - comfort_normalized)


def score_habit_comfort_axis(
    habit_a: float,
    comfort_a: float,
    habit_b: float,
    comfort_b: float,
) -> float:
    mismatch_ab = directional_mismatch(habit_a, comfort_b)
    mismatch_ba = directional_mismatch(habit_b, comfort_a)
    mismatch_axis = (mismatch_ab + mismatch_ba) / 2.0
    return 1.0 - mismatch_axis


def score_q4_room_use(
    habit_a: float,
    comfort_a: float,
    habit_b: float,
    comfort_b: float,
) -> float:
    return score_habit_comfort_axis(habit_a, comfort_a, habit_b, comfort_b)


def score_q5_night_activity(
    habit_a: float,
    comfort_a: float,
    habit_b: float,
    comfort_b: float,
) -> float:
    return score_habit_comfort_axis(habit_a, comfort_a, habit_b, comfort_b)


def score_q10_lifestyle_tolerance(value_a: float, value_b: float) -> float:
    norm_a = _normalize_lifestyle_tolerance(value_a)
    norm_b = _normalize_lifestyle_tolerance(value_b)
    return 1.0 - abs(norm_a - norm_b)
