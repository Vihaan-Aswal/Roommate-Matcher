import pytest

from app.services.scoring.mismatch import (
    directional_mismatch,
    score_q4_room_use,
    score_q5_night_activity,
    score_q10_lifestyle_tolerance,
)


def test_directional_mismatch_penalizes_only_when_habit_exceeds_comfort() -> None:
    assert directional_mismatch(2.0, 0.0) == 1.0
    assert directional_mismatch(1.0, 3.0) == 0.0


def test_directional_mismatch_is_asymmetric_for_cross_profiles() -> None:
    mismatch_ab = directional_mismatch(2.0, 0.0)
    mismatch_ba = directional_mismatch(0.0, 3.0)

    assert mismatch_ab == 1.0
    assert mismatch_ba == 0.0
    assert mismatch_ab != mismatch_ba


def test_room_use_axis_score_averages_directions() -> None:
    score = score_q4_room_use(
        habit_a=2.0,
        comfort_a=3.0,
        habit_b=0.0,
        comfort_b=0.0,
    )
    assert score == 0.5


def test_night_activity_uses_same_axis_logic() -> None:
    score = score_q5_night_activity(
        habit_a=1.0,
        comfort_a=2.0,
        habit_b=1.0,
        comfort_b=2.0,
    )
    assert score == 1.0


def test_q10_lifestyle_tolerance_symmetry_and_extremes() -> None:
    assert score_q10_lifestyle_tolerance(0.0, 0.0) == 1.0
    assert score_q10_lifestyle_tolerance(0.0, 3.0) == 0.0
    assert score_q10_lifestyle_tolerance(1.0, 2.0) == score_q10_lifestyle_tolerance(2.0, 1.0)


def test_mismatch_rejects_out_of_range_values() -> None:
    with pytest.raises(ValueError, match="Habit value"):
        directional_mismatch(2.5, 1.0)

    with pytest.raises(ValueError, match="Lifestyle tolerance value"):
        score_q10_lifestyle_tolerance(-1.0, 1.0)
