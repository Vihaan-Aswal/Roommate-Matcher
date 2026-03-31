from __future__ import annotations

from app.services.matching.labels import classify_student, derive_satisfaction_label
from app.services.matching.pair_lookup import normalize_and_validate_pair_results
from tests.matching.fixtures import build_pair_results


def test_derive_satisfaction_label_boundaries() -> None:
    assert derive_satisfaction_label(0.90, safety_passed=True) == "Excellent"
    assert derive_satisfaction_label(0.90, safety_passed=False) == "Good"
    assert derive_satisfaction_label(0.70, safety_passed=True) == "Good"
    assert derive_satisfaction_label(0.55, safety_passed=True) == "Okay"
    assert derive_satisfaction_label(0.5499, safety_passed=True) == "Poor"


def test_classify_student_enforces_excellent_safety_gate() -> None:
    students = ["A", "B", "C"]
    pair_results = normalize_and_validate_pair_results(
        students,
        build_pair_results(
            students,
            default_score=0.95,
            excellent_overrides={
                ("A", "B"): True,
                ("A", "C"): False,
                ("B", "C"): True,
            },
        ),
    )

    label, safety, is_at_risk = classify_student(
        student_id="A",
        roommate_ids=["B", "C"],
        satisfaction_score=0.95,
        pair_results=pair_results,
    )

    assert safety is False
    assert label == "Good"
    assert is_at_risk is False


def test_classify_student_at_risk_threshold() -> None:
    students = ["A", "B"]
    pair_results = normalize_and_validate_pair_results(students, build_pair_results(students, default_score=0.5))

    label_a, _, risk_a = classify_student(
        student_id="A",
        roommate_ids=["B"],
        satisfaction_score=0.55,
        pair_results=pair_results,
    )
    label_b, _, risk_b = classify_student(
        student_id="A",
        roommate_ids=["B"],
        satisfaction_score=0.549,
        pair_results=pair_results,
    )

    assert label_a == "Okay"
    assert risk_a is False
    assert label_b == "Poor"
    assert risk_b is True
