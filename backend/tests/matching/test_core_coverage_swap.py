from __future__ import annotations

from app.services.matching.pair_lookup import normalize_and_validate_pair_results
from app.services.matching.swap_optimizer import (
    _StateEvaluation,
    _evaluate_state,
    _is_better_candidate,
    optimize_swaps,
)
from tests.matching.fixtures import build_pair_results


def _evaluation(minimum: float, poor: int, total: float) -> _StateEvaluation:
    return _StateEvaluation(
        minimum_satisfaction=minimum,
        poor_count=poor,
        total_satisfaction=total,
        labels_by_student={},
    )


def test_is_better_candidate_prefers_higher_minimum_satisfaction() -> None:
    assert _is_better_candidate(
        _evaluation(0.8, 0, 1.0),
        _evaluation(0.7, 0, 1.0),
        ("R1", "A", "R2", "B"),
        ("R1", "A", "R2", "C"),
    )


def test_is_better_candidate_rejects_lower_minimum_satisfaction() -> None:
    assert not _is_better_candidate(
        _evaluation(0.7, 0, 1.0),
        _evaluation(0.8, 0, 1.0),
        ("R1", "A", "R2", "B"),
        ("R1", "A", "R2", "C"),
    )


def test_is_better_candidate_prefers_fewer_poor_students() -> None:
    assert _is_better_candidate(
        _evaluation(0.7, 0, 1.0),
        _evaluation(0.7, 1, 1.0),
        ("R1", "A", "R2", "B"),
        ("R1", "A", "R2", "C"),
    )


def test_is_better_candidate_rejects_more_poor_students() -> None:
    assert not _is_better_candidate(
        _evaluation(0.7, 1, 1.0),
        _evaluation(0.7, 0, 1.0),
        ("R1", "A", "R2", "B"),
        ("R1", "A", "R2", "C"),
    )


def test_is_better_candidate_prefers_higher_total_satisfaction() -> None:
    assert _is_better_candidate(
        _evaluation(0.7, 0, 5.0),
        _evaluation(0.7, 0, 4.0),
        ("R1", "A", "R2", "B"),
        ("R1", "A", "R2", "C"),
    )


def test_is_better_candidate_rejects_lower_total_satisfaction() -> None:
    assert not _is_better_candidate(
        _evaluation(0.7, 0, 4.0),
        _evaluation(0.7, 0, 5.0),
        ("R1", "A", "R2", "B"),
        ("R1", "A", "R2", "C"),
    )


def test_is_better_candidate_breaks_full_tie_on_signature() -> None:
    assert _is_better_candidate(
        _evaluation(0.7, 0, 5.0),
        _evaluation(0.7, 0, 5.0),
        ("R1", "A", "R2", "B"),
        ("R1", "A", "R2", "C"),
    )
    assert not _is_better_candidate(
        _evaluation(0.7, 0, 5.0),
        _evaluation(0.7, 0, 5.0),
        ("R1", "A", "R2", "C"),
        ("R1", "A", "R2", "B"),
    )


def test_evaluate_state_aggregates_every_room() -> None:
    students = ["A", "B", "C", "D"]
    pair_results = normalize_and_validate_pair_results(
        students,
        build_pair_results(
            students,
            default_score=0.3,
            score_overrides={
                ("A", "B"): 0.2,
                ("C", "D"): 0.9,
            },
        ),
    )

    evaluation = _evaluate_state({"R1": ["A", "B"], "R2": ["C", "D"]}, pair_results)

    assert evaluation.minimum_satisfaction == 0.2
    assert evaluation.poor_count == 2
    assert evaluation.total_satisfaction == 2.2
    assert evaluation.labels_by_student == {
        "A": "Poor",
        "B": "Poor",
        "C": "Excellent",
        "D": "Excellent",
    }


def test_optimize_swaps_keeps_best_of_several_improving_swaps() -> None:
    students = ["A", "B", "C", "D"]
    pair_results = normalize_and_validate_pair_results(
        students,
        build_pair_results(
            students,
            default_score=0.2,
            score_overrides={
                ("A", "C"): 0.9,
                ("A", "D"): 0.4,
                ("B", "C"): 0.4,
                ("B", "D"): 0.9,
            },
        ),
    )

    optimized, passes = optimize_swaps({"R1": ["A", "B"], "R2": ["C", "D"]}, pair_results)

    assert passes == 1
    assert optimized == {"R1": ["B", "D"], "R2": ["A", "C"]}


def test_optimize_swaps_with_zero_passes_returns_input_unchanged() -> None:
    students = ["A", "B", "C", "D"]
    pair_results = normalize_and_validate_pair_results(
        students,
        build_pair_results(students, default_score=0.6),
    )

    optimized, passes = optimize_swaps(
        {"R1": ["B", "A"], "R2": ["D", "C"]},
        pair_results,
        max_passes=0,
    )

    assert passes == 0
    assert optimized == {"R1": ["A", "B"], "R2": ["C", "D"]}
