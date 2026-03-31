from __future__ import annotations

from app.services.explainability.room_aggregation import aggregate_student_factors

from .conftest import build_pair_results


def test_two_person_room_uses_direct_pair_factor_scores() -> None:
    students = ["S01", "S02"]
    pair_results = build_pair_results(
        students,
        pair_factor_overrides={
            ("S01", "S02"): {
                "q1_enc": 0.83,
                "q2_enc": 0.92,
            }
        },
    )

    aggregated = aggregate_student_factors(
        student_id="S01",
        room_student_ids=students,
        pair_results=pair_results,
    )
    by_factor = {item.factor_key: item for item in aggregated}

    assert by_factor["q1_enc"].aggregated_raw_score == 0.83
    assert by_factor["q1_enc"].coverage_count == 1
    assert by_factor["q2_enc"].aggregated_raw_score == 0.92
    assert by_factor["q2_enc"].coverage_count == 1


def test_two_person_aggregation_marks_missing_factor_when_pair_data_missing() -> None:
    students = ["S01", "S02"]
    pair_results = build_pair_results(
        students,
        pair_missing_overrides={("S01", "S02"): {"q7_enc"}},
    )

    aggregated = aggregate_student_factors(
        student_id="S01",
        room_student_ids=students,
        pair_results=pair_results,
    )
    by_factor = {item.factor_key: item for item in aggregated}

    assert by_factor["q7_enc"].aggregated_raw_score == 0.50
    assert by_factor["q7_enc"].aggregated_missing_data is True
    assert by_factor["q7_enc"].classified.factor_class == "Neutral"
