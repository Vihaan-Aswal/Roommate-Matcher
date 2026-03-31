from __future__ import annotations

import pytest

from app.services.explainability.room_aggregation import aggregate_student_factors

from .conftest import build_pair_results


def test_three_person_aggregation_uses_mean_of_two_roommate_edges() -> None:
    students = ["A", "B", "C"]
    pair_results = build_pair_results(
        students,
        pair_factor_overrides={
            ("A", "B"): {"q1_enc": 0.90},
            ("A", "C"): {"q1_enc": 0.50},
            ("B", "C"): {"q1_enc": 0.60},
        },
    )

    aggregated_for_a = aggregate_student_factors(
        student_id="A",
        room_student_ids=students,
        pair_results=pair_results,
    )
    q1 = {item.factor_key: item for item in aggregated_for_a}["q1_enc"]

    assert q1.aggregated_raw_score == 0.70
    assert q1.coverage_count == 2
    assert q1.classified.factor_class == "Moderate Match"


def test_three_person_aggregation_is_not_single_pair_artifact() -> None:
    students = ["A", "B", "C"]
    pair_results = build_pair_results(
        students,
        pair_factor_overrides={
            ("A", "B"): {"q2_enc": 0.96},
            ("A", "C"): {"q2_enc": 0.36},
            ("B", "C"): {"q2_enc": 0.80},
        },
    )

    aggregated_for_a = aggregate_student_factors(
        student_id="A",
        room_student_ids=students,
        pair_results=pair_results,
    )
    q2 = {item.factor_key: item for item in aggregated_for_a}["q2_enc"]

    assert q2.aggregated_raw_score == pytest.approx(0.66)
    assert q2.aggregated_raw_score != 0.96
    assert q2.aggregated_raw_score != 0.36
