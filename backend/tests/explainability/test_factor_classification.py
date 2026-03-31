from __future__ import annotations

import pytest

from app.services.explainability.factor_classification import (
    EPSILON,
    THRESHOLD_TABLES,
    WEIGHT_CLASS_BY_FACTOR,
    classify_score_for_weight_class,
)


def test_weight_classes_match_expected_factor_groups() -> None:
    assert {key for key, value in WEIGHT_CLASS_BY_FACTOR.items() if value == "heavy"} == {
        "q1_enc",
        "q2_enc",
        "q6_enc",
    }
    assert {key for key, value in WEIGHT_CLASS_BY_FACTOR.items() if value == "medium"} == {
        "q3_enc",
        "q4a_enc",
        "q5a_enc",
    }
    assert {key for key, value in WEIGHT_CLASS_BY_FACTOR.items() if value == "light"} == {
        "q7_enc",
        "q8_enc",
        "q9_enc",
        "q10_enc",
    }


@pytest.mark.parametrize(
    ("weight_class", "boundary", "at_boundary", "just_below"),
    [
        ("heavy", 0.90, "Strong Match", "Moderate Match"),
        ("heavy", 0.70, "Moderate Match", "Neutral"),
        ("heavy", 0.55, "Neutral", "Moderate Mismatch"),
        ("heavy", 0.30, "Moderate Mismatch", "Strong Mismatch"),
        ("medium", 0.85, "Strong Match", "Moderate Match"),
        ("medium", 0.65, "Moderate Match", "Neutral"),
        ("medium", 0.45, "Neutral", "Moderate Mismatch"),
        ("medium", 0.25, "Moderate Mismatch", "Strong Mismatch"),
        ("light", 0.80, "Strong Match", "Moderate Match"),
        ("light", 0.60, "Moderate Match", "Neutral"),
        ("light", 0.40, "Neutral", "Moderate Mismatch"),
        ("light", 0.20, "Moderate Mismatch", "Strong Mismatch"),
    ],
)
def test_threshold_boundaries_use_inclusive_lower_bounds(
    weight_class: str,
    boundary: float,
    at_boundary: str,
    just_below: str,
) -> None:
    assert classify_score_for_weight_class(weight_class, boundary) == at_boundary
    assert classify_score_for_weight_class(weight_class, boundary - (2 * EPSILON)) == just_below


@pytest.mark.parametrize("weight_class", ["heavy", "medium", "light"])
def test_threshold_tables_have_complete_class_chain(weight_class: str) -> None:
    classes = [factor_class for factor_class, _ in THRESHOLD_TABLES[weight_class]]
    assert classes == [
        "Strong Match",
        "Moderate Match",
        "Neutral",
        "Moderate Mismatch",
        "Strong Mismatch",
    ]
