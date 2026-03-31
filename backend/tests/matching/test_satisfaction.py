from __future__ import annotations

from math import isclose

from app.services.matching.satisfaction import compute_group_score, compute_student_satisfaction_scores
from app.services.matching.pair_lookup import normalize_and_validate_pair_results
from tests.matching.fixtures import build_pair_results


def test_compute_student_satisfaction_for_2bed_formula() -> None:
    students = ["A", "B"]
    pair_results = normalize_and_validate_pair_results(
        students,
        build_pair_results(students, default_score=0.82),
    )

    scores = compute_student_satisfaction_scores(students, pair_results)

    assert scores["A"] == 0.82
    assert scores["B"] == 0.82


def test_compute_student_satisfaction_for_3bed_formula() -> None:
    students = ["A", "B", "C"]
    pair_results = normalize_and_validate_pair_results(
        students,
        build_pair_results(
            students,
            default_score=0.0,
            score_overrides={
                ("A", "B"): 0.9,
                ("A", "C"): 0.7,
                ("B", "C"): 0.5,
            },
        ),
    )

    scores = compute_student_satisfaction_scores(students, pair_results)

    assert isclose(scores["A"], 0.8, rel_tol=0.0, abs_tol=1e-12)
    assert isclose(scores["B"], 0.7, rel_tol=0.0, abs_tol=1e-12)
    assert isclose(scores["C"], 0.6, rel_tol=0.0, abs_tol=1e-12)


def test_compute_student_satisfaction_for_4bed_formula() -> None:
    students = ["A", "B", "C", "D"]
    pair_results = normalize_and_validate_pair_results(
        students,
        build_pair_results(
            students,
            default_score=0.6,
            score_overrides={
                ("A", "B"): 0.9,
                ("A", "C"): 0.6,
                ("A", "D"): 0.3,
            },
        ),
    )

    scores = compute_student_satisfaction_scores(students, pair_results)

    assert isclose(scores["A"], (0.9 + 0.6 + 0.3) / 3, rel_tol=0.0, abs_tol=1e-12)


def test_compute_group_score_uses_all_unordered_pairs() -> None:
    students = ["A", "B", "C", "D"]
    pair_results = normalize_and_validate_pair_results(
        students,
        build_pair_results(
            students,
            default_score=0.0,
            score_overrides={
                ("A", "B"): 1.0,
                ("A", "C"): 0.9,
                ("A", "D"): 0.8,
                ("B", "C"): 0.7,
                ("B", "D"): 0.6,
                ("C", "D"): 0.5,
            },
        ),
    )

    group_score = compute_group_score(students, pair_results)

    assert isclose(group_score, (1.0 + 0.9 + 0.8 + 0.7 + 0.6 + 0.5) / 6, rel_tol=0.0, abs_tol=1e-12)
