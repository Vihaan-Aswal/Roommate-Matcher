from __future__ import annotations

import pytest

from app.services.explainability.contracts import RoomExplanationContext
from app.services.explainability.service import generate_room_explanations
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


@pytest.mark.parametrize(
    ("label", "score"),
    [
        ("Excellent", 0.95),
        ("Good", 0.75),
        ("Okay", 0.60),
        ("Poor", 0.45),
    ],
)
def test_two_person_explanation_paths_cover_all_labels(label: str, score: float) -> None:
    students = ["S01", "S02"]
    pair_results = build_pair_results(
        students,
        default_factor_score=score,
        pair_score_overrides={("S01", "S02"): score},
    )

    context = RoomExplanationContext(
        segment_key=f"SEG_{label}",
        room_id=f"ROOM_{label}",
        room_size=2,
        student_ids=students,
        pair_results=pair_results,
        student_satisfaction={"S01": score, "S02": score},
        student_labels={"S01": label, "S02": label},
        student_at_risk={"S01": score < 0.55, "S02": score < 0.55},
        reason_mode="assigned_room",
    )

    explanations = generate_room_explanations(context)

    assert len(explanations) == 2
    assert all(1 <= len(item.reasons) <= 3 for item in explanations)
