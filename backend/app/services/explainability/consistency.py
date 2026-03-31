from __future__ import annotations

from collections import defaultdict

from app.services.explainability.reason_selection import ReasonCandidate
from app.services.scoring.constants import SCORING_FACTOR_KEYS

FACTOR_INDEX = {factor_key: idx for idx, factor_key in enumerate(SCORING_FACTOR_KEYS)}


def _is_positive(candidate: ReasonCandidate) -> bool:
    return candidate.factor_class in {"Strong Match", "Moderate Match"}


def _is_mismatch(candidate: ReasonCandidate) -> bool:
    return candidate.factor_class in {"Strong Mismatch", "Moderate Mismatch"}


def _strength_magnitude(candidate: ReasonCandidate) -> float:
    if _is_positive(candidate):
        return candidate.raw_score
    if _is_mismatch(candidate):
        return 1.0 - candidate.raw_score
    return 0.0


def _room_shared_rank(candidate: ReasonCandidate) -> tuple[float, float, int, str]:
    return (
        _strength_magnitude(candidate),
        candidate.weight_used,
        -FACTOR_INDEX.get(candidate.factor_key, len(FACTOR_INDEX)),
        candidate.factor_key,
    )


def enforce_room_consistency(
    selected_by_student: dict[str, list[ReasonCandidate]],
) -> dict[str, list[ReasonCandidate]]:
    retained_by_student = {
        student_id: list(reasons)
        for student_id, reasons in selected_by_student.items()
    }

    grouped: dict[str, list[tuple[str, ReasonCandidate]]] = defaultdict(list)
    for student_id, reasons in retained_by_student.items():
        for reason in reasons:
            if reason.claim_scope != "room_shared_claim":
                continue
            grouped[reason.reason_bucket].append((student_id, reason))

    for reason_bucket, grouped_reasons in grouped.items():
        has_positive = any(_is_positive(reason) for _, reason in grouped_reasons)
        has_mismatch = any(_is_mismatch(reason) for _, reason in grouped_reasons)
        if not (has_positive and has_mismatch):
            continue

        winning_student_id, winning_reason = max(
            grouped_reasons,
            key=lambda pair: _room_shared_rank(pair[1]),
        )
        winning_is_positive = _is_positive(winning_reason)

        for student_id, reason in grouped_reasons:
            if student_id == winning_student_id:
                continue

            if winning_is_positive and _is_mismatch(reason):
                retained_by_student[student_id] = [
                    item
                    for item in retained_by_student[student_id]
                    if item is not reason
                ]
            elif (not winning_is_positive) and _is_positive(reason):
                retained_by_student[student_id] = [
                    item
                    for item in retained_by_student[student_id]
                    if item is not reason
                ]

    return retained_by_student
