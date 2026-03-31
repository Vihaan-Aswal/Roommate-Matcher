from __future__ import annotations

from app.services.explainability.room_aggregation import aggregate_room_factors

from .conftest import build_pair_results


def test_four_person_aggregation_uses_three_roommate_edges() -> None:
    students = ["A", "B", "C", "D"]
    pair_results = build_pair_results(
        students,
        pair_factor_overrides={
            ("A", "B"): {"q2_enc": 0.80},
            ("A", "C"): {"q2_enc": 0.60},
            ("A", "D"): {"q2_enc": 0.40},
        },
    )

    aggregated = aggregate_room_factors(room_student_ids=students, pair_results=pair_results)
    q2 = {item.factor_key: item for item in aggregated["A"]}["q2_enc"]

    assert q2.aggregated_raw_score == 0.60
    assert q2.coverage_count == 3


def test_four_person_aggregation_is_deterministic_across_repeated_runs() -> None:
    students = ["A", "B", "C", "D"]
    pair_results = build_pair_results(students, default_factor_score=0.63)

    first = aggregate_room_factors(room_student_ids=students, pair_results=pair_results)
    second = aggregate_room_factors(room_student_ids=students, pair_results=pair_results)

    assert first == second


def test_four_person_aggregation_uses_missing_fallback_when_no_edge_data_exists() -> None:
    students = ["A", "B", "C", "D"]
    pair_results = build_pair_results(
        students,
        pair_missing_overrides={
            ("A", "B"): {"q10_enc"},
            ("A", "C"): {"q10_enc"},
            ("A", "D"): {"q10_enc"},
        },
    )

    aggregated = aggregate_room_factors(room_student_ids=students, pair_results=pair_results)
    q10 = {item.factor_key: item for item in aggregated["A"]}["q10_enc"]

    assert q10.aggregated_raw_score == 0.50
    assert q10.aggregated_missing_data is True
    assert q10.coverage_count == 0
