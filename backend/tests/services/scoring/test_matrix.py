import pytest

from app.services.scoring.matrix import score_q6_smoking, score_q7_drinking, score_q8_diet


def test_smoking_matrix_values() -> None:
    assert score_q6_smoking(1.0, 1.0) == 1.0
    assert score_q6_smoking(1.0, 2.0) == 0.6
    assert score_q6_smoking(2.0, 3.0) == 0.5
    assert score_q6_smoking(1.0, 3.0) == 0.0


def test_drinking_matrix_values() -> None:
    assert score_q7_drinking(1.0, 1.0) == 1.0
    assert score_q7_drinking(1.0, 2.0) == 0.7
    assert score_q7_drinking(2.0, 3.0) == 0.7
    assert score_q7_drinking(1.0, 3.0) == 0.0


def test_diet_matrix_values() -> None:
    assert score_q8_diet(1.0, 1.0) == 1.0
    assert score_q8_diet(1.0, 2.0) == 0.7
    assert score_q8_diet(2.0, 3.0) == 0.7
    assert score_q8_diet(1.0, 3.0) == 0.0


def test_matrix_rejects_invalid_values() -> None:
    with pytest.raises(ValueError, match="Unsupported matrix value"):
        score_q6_smoking(4.0, 1.0)

    with pytest.raises(ValueError, match="Unsupported matrix value"):
        score_q7_drinking(1.0, 0.0)
