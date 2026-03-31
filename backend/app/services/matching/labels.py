from __future__ import annotations

from app.services.matching.contracts import SatisfactionLabel
from app.services.matching.pair_lookup import get_pair_result
from app.services.scoring.types import PairResult

EXCELLENT_THRESHOLD = 0.90
GOOD_THRESHOLD = 0.70
OKAY_THRESHOLD = 0.55


def excellent_safety_passed(
    student_id: str,
    roommate_ids: list[str],
    pair_results: dict[tuple[str, str], PairResult],
) -> bool:
    return all(get_pair_result(pair_results, student_id, roommate).excellent_candidate for roommate in roommate_ids)


def derive_satisfaction_label(
    satisfaction_score: float,
    safety_passed: bool,
) -> SatisfactionLabel:
    if satisfaction_score >= EXCELLENT_THRESHOLD and safety_passed:
        return "Excellent"
    if satisfaction_score >= GOOD_THRESHOLD:
        return "Good"
    if satisfaction_score >= OKAY_THRESHOLD:
        return "Okay"
    return "Poor"


def classify_student(
    student_id: str,
    roommate_ids: list[str],
    satisfaction_score: float,
    pair_results: dict[tuple[str, str], PairResult],
) -> tuple[SatisfactionLabel, bool, bool]:
    safety_passed = excellent_safety_passed(student_id, roommate_ids, pair_results)
    label = derive_satisfaction_label(satisfaction_score=satisfaction_score, safety_passed=safety_passed)
    is_at_risk = satisfaction_score < OKAY_THRESHOLD
    return label, safety_passed, is_at_risk
