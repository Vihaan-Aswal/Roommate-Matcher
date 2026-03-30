import pytest

from app.services.scoring.distance import (
    score_distance_factor,
    score_q1_sleep,
    score_q2_cleanliness,
    score_q3_late_return,
    score_q9_budget,
)


def test_q1_sleep_distance_scores() -> None:
    assert score_q1_sleep(1.0, 1.0) == 1.0
    assert score_q1_sleep(1.0, 2.0) == 0.6
    assert score_q1_sleep(1.0, 3.0) == 0.2
    assert score_q1_sleep(1.0, 4.0) == 0.0


def test_q2_cleanliness_distance_scores() -> None:
    assert score_q2_cleanliness(1.0, 1.0) == 1.0
    assert score_q2_cleanliness(1.0, 2.0) == 0.5
    assert score_q2_cleanliness(1.0, 3.0) == 0.0


def test_q3_late_return_distance_scores() -> None:
    assert score_q3_late_return(1.0, 1.0) == 1.0
    assert score_q3_late_return(1.0, 2.0) == 0.6
    assert score_q3_late_return(1.0, 3.0) == 0.2


def test_q9_budget_distance_scores() -> None:
    assert score_q9_budget(1.0, 1.0) == 1.0
    assert score_q9_budget(1.0, 2.0) == 0.7
    assert score_q9_budget(1.0, 3.0) == 0.3


def test_distance_factor_rejects_unknown_factor() -> None:
    with pytest.raises(ValueError, match="Unsupported distance factor"):
        score_distance_factor("q100_enc", 1.0, 2.0)


def test_distance_factor_rejects_non_integer_distance() -> None:
    with pytest.raises(ValueError, match="must be an integer"):
        score_q1_sleep(1.0, 2.5)
