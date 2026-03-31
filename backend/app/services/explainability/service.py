from __future__ import annotations

import hashlib

from app.services.explainability.consistency import enforce_room_consistency
from app.services.explainability.contracts import (
    HypotheticalGroupInput,
    RoomExplanationContext,
    StudentExplanation,
)
from app.services.explainability.reason_selection import (
    ReasonCandidate,
    build_reason_candidates,
    select_reason_candidates,
)
from app.services.explainability.room_aggregation import aggregate_student_factors
from app.services.explainability.template_renderer import render_reason_lines
from app.services.matching.labels import classify_student
from app.services.matching.satisfaction import compute_student_satisfaction_scores


def _neutral_fallback_candidate() -> ReasonCandidate:
    return ReasonCandidate(
        factor_key="_context",
        reason_bucket="neutral_context_room",
        factor_class="Neutral",
        polarity="neutral_context",
        raw_score=0.50,
        weight_used=0.0,
        claim_scope="room_shared_claim",
        missing_data=False,
    )


def _validate_context(context: RoomExplanationContext) -> None:
    if context.room_size not in (2, 3, 4):
        raise ValueError(f"Unsupported room_size for explanation: {context.room_size}")

    sorted_students = sorted(context.student_ids)
    if len(sorted_students) != context.room_size:
        raise ValueError(
            f"room_size {context.room_size} does not match student count {len(sorted_students)}"
        )

    if len(set(sorted_students)) != len(sorted_students):
        raise ValueError("student_ids must be unique")

    required_student_set = set(sorted_students)
    if set(context.student_satisfaction) != required_student_set:
        raise ValueError("student_satisfaction keys must match student_ids")
    if set(context.student_labels) != required_student_set:
        raise ValueError("student_labels keys must match student_ids")
    if set(context.student_at_risk) != required_student_set:
        raise ValueError("student_at_risk keys must match student_ids")


def generate_room_explanations(context: RoomExplanationContext) -> list[StudentExplanation]:
    _validate_context(context)

    selected_by_student: dict[str, list[ReasonCandidate]] = {}
    for student_id in sorted(context.student_ids):
        aggregated = aggregate_student_factors(
            student_id=student_id,
            room_student_ids=context.student_ids,
            pair_results=context.pair_results,
        )
        candidates = build_reason_candidates([item.classified for item in aggregated])
        selected = select_reason_candidates(context.student_labels[student_id], candidates)
        if not selected:
            selected = [_neutral_fallback_candidate()]
        selected_by_student[student_id] = selected

    consistent_selected = enforce_room_consistency(selected_by_student)

    explanations: list[StudentExplanation] = []
    for student_id in sorted(context.student_ids):
        selected = consistent_selected.get(student_id, [])
        if not selected:
            selected = [_neutral_fallback_candidate()]

        reasons, traces = render_reason_lines(
            student_id=student_id,
            room_id=context.room_id,
            selected_candidates=selected,
        )

        explanations.append(
            StudentExplanation(
                student_id=student_id,
                room_id=context.room_id,
                satisfaction_label=context.student_labels[student_id],
                is_at_risk=context.student_at_risk[student_id],
                reasons=reasons,
                factor_trace=[trace.to_dict() for trace in traces],
            )
        )

    explanations.sort(key=lambda item: item.student_id)
    return explanations


def generate_explanation(student_id: str, context: RoomExplanationContext) -> list[str]:
    for explanation in generate_room_explanations(context):
        if explanation.student_id == student_id:
            return explanation.reasons
    raise ValueError(f"Student {student_id} is not in room context")


def _build_hypothetical_room_id(segment_key: str, room_size: int, student_ids: list[str]) -> str:
    payload = "|".join(sorted(student_ids))
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:8]
    return f"{segment_key}_HYP_{room_size}_{digest}"


def explain_hypothetical_group(input: HypotheticalGroupInput) -> list[StudentExplanation]:
    student_ids = sorted(input.student_ids)
    room_id = _build_hypothetical_room_id(input.segment_key, input.room_size, student_ids)

    if input.precomputed_satisfaction is not None and input.precomputed_labels is not None:
        student_satisfaction = dict(input.precomputed_satisfaction)
        student_labels = dict(input.precomputed_labels)
    else:
        student_satisfaction = compute_student_satisfaction_scores(student_ids, input.pair_results)
        student_labels: dict[str, str] = {}
        for student_id in student_ids:
            roommates = [roommate for roommate in student_ids if roommate != student_id]
            label, _, _ = classify_student(
                student_id=student_id,
                roommate_ids=roommates,
                satisfaction_score=student_satisfaction[student_id],
                pair_results=input.pair_results,
            )
            student_labels[student_id] = label

    student_at_risk = {
        student_id: student_satisfaction[student_id] < 0.55
        for student_id in student_ids
    }

    context = RoomExplanationContext(
        segment_key=input.segment_key,
        room_id=room_id,
        room_size=input.room_size,
        student_ids=student_ids,
        pair_results=input.pair_results,
        student_satisfaction=student_satisfaction,
        student_labels=student_labels,
        student_at_risk=student_at_risk,
        reason_mode="hypothetical_group",
    )
    return generate_room_explanations(context)
