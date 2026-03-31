from __future__ import annotations

from app.services.matching.satisfaction import compute_student_satisfaction_scores
from app.services.matching.swap_optimizer import optimize_swaps
from app.services.matching.pair_lookup import normalize_and_validate_pair_results
from tests.matching.fixtures import build_pair_results


def _minimum_satisfaction(state: dict[str, list[str]], pair_results: dict[tuple[str, str], object]) -> float:
    scores: list[float] = []
    for room_students in state.values():
        room_scores = compute_student_satisfaction_scores(room_students, pair_results)
        scores.extend(room_scores.values())
    return min(scores)


def test_optimize_swaps_improves_global_minimum_satisfaction() -> None:
    students = ["A", "B", "C", "D"]
    pair_results = normalize_and_validate_pair_results(
        students,
        build_pair_results(
            students,
            default_score=0.3,
            score_overrides={
                ("A", "B"): 0.2,
                ("C", "D"): 0.8,
                ("A", "C"): 0.9,
                ("B", "D"): 0.9,
                ("A", "D"): 0.3,
                ("B", "C"): 0.3,
            },
        ),
    )

    initial = {
        "R1": ["A", "B"],
        "R2": ["C", "D"],
    }
    baseline_min = _minimum_satisfaction(initial, pair_results)

    optimized, passes = optimize_swaps(initial, pair_results)
    improved_min = _minimum_satisfaction(optimized, pair_results)

    assert passes >= 1
    assert improved_min > baseline_min


def test_optimize_swaps_no_valid_swap_keeps_state_unchanged() -> None:
    students = ["A", "B", "C", "D"]
    pair_results = normalize_and_validate_pair_results(students, build_pair_results(students, default_score=0.8))

    initial = {
        "R1": ["A", "B"],
        "R2": ["C", "D"],
    }

    optimized, passes = optimize_swaps(initial, pair_results)

    assert passes == 0
    assert optimized == {
        "R1": ["A", "B"],
        "R2": ["C", "D"],
    }


def test_optimize_swaps_rejects_swap_that_creates_new_poor_student() -> None:
    students = ["A", "B", "C", "D"]
    pair_results = normalize_and_validate_pair_results(
        students,
        build_pair_results(
            students,
            default_score=0.2,
            score_overrides={
                ("A", "B"): 0.4,
                ("C", "D"): 0.8,
                ("A", "C"): 0.9,
                ("B", "D"): 0.5,
                ("A", "D"): 0.45,
                ("B", "C"): 0.45,
            },
        ),
    )

    initial = {
        "R1": ["A", "B"],
        "R2": ["C", "D"],
    }

    optimized, passes = optimize_swaps(initial, pair_results)

    assert passes == 0
    assert optimized == {
        "R1": ["A", "B"],
        "R2": ["C", "D"],
    }


def test_optimize_swaps_pass_count_never_exceeds_cap() -> None:
    students = [f"S{i:02d}" for i in range(1, 9)]
    pair_results = normalize_and_validate_pair_results(students, build_pair_results(students, default_score=0.6))

    initial = {
        "R1": ["S01", "S02"],
        "R2": ["S03", "S04"],
        "R3": ["S05", "S06"],
        "R4": ["S07", "S08"],
    }

    _, passes = optimize_swaps(initial, pair_results, max_passes=3)

    assert passes <= 3
