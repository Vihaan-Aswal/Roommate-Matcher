from __future__ import annotations

import hashlib
from itertools import combinations

from app.services.explainability.consistency import enforce_room_consistency
from app.services.explainability.contracts import (
    HypotheticalGroupInput,
    RoomExplanationContext,
    StudentExplanation,
)
from app.services.explainability.factor_classification import ClassifiedFactor, classify_factor
from app.services.explainability.reason_selection import (
    MAX_REASONS,
    ReasonCandidate,
    build_reason_candidates,
    select_reason_candidates,
)
from app.services.explainability.room_aggregation import aggregate_student_factors
from app.services.explainability.template_renderer import render_reason_lines
from app.services.matching.labels import OKAY_THRESHOLD, classify_student
from app.services.matching.pair_lookup import canonical_pair
from app.services.matching.satisfaction import compute_student_satisfaction_scores
from app.services.scoring.constants import FACTOR_BASE_WEIGHTS, SCORING_FACTOR_KEYS
from app.services.scoring.types import PairResult


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


def _build_room_shared_classified_factors(
    *,
    room_student_ids: list[str],
    pair_results: dict[tuple[str, str], PairResult],
) -> list[ClassifiedFactor]:
    sorted_students = sorted(room_student_ids)
    classified_factors: list[ClassifiedFactor] = []

    for factor_key in SCORING_FACTOR_KEYS:
        observed_scores: list[float] = []
        for student_a, student_b in combinations(sorted_students, 2):
            pair_key = canonical_pair(student_a, student_b)
            pair_result = pair_results.get(pair_key)
            if pair_result is None:
                raise ValueError(f"Missing pair result for room edge {pair_key}")

            factor_score = pair_result.factor_breakdown.get(factor_key)
            if factor_score is None:
                raise ValueError(f"Missing factor {factor_key} for room edge {pair_key}")

            if factor_score.missing_data:
                continue
            observed_scores.append(factor_score.raw_score)

        if observed_scores:
            aggregated_raw_score = sum(observed_scores) / len(observed_scores)
            aggregated_missing_data = False
        else:
            aggregated_raw_score = 0.50
            aggregated_missing_data = True

        classified_factors.append(
            classify_factor(
                factor_key=factor_key,
                raw_score=aggregated_raw_score,
                weight_used=FACTOR_BASE_WEIGHTS[factor_key],
                missing_data=aggregated_missing_data,
            )
        )

    return classified_factors


def _merge_reason_candidates(
    primary: list[ReasonCandidate],
    secondary: list[ReasonCandidate],
    *,
    max_reasons: int,
) -> list[ReasonCandidate]:
    merged: list[ReasonCandidate] = []
    seen_keys: set[tuple[str, str]] = set()

    for candidate in primary + secondary:
        candidate_key = (candidate.reason_bucket, candidate.claim_scope)
        if candidate_key in seen_keys:
            continue
        seen_keys.add(candidate_key)
        merged.append(candidate)
        if len(merged) >= max_reasons:
            break

    return merged


def generate_room_explanations(context: RoomExplanationContext) -> list[StudentExplanation]:
    _validate_context(context)

    room_shared_candidates: list[ReasonCandidate] = []
    if context.room_size in (3, 4):
        room_shared_candidates = build_reason_candidates(
            _build_room_shared_classified_factors(
                room_student_ids=context.student_ids,
                pair_results=context.pair_results,
            ),
            claim_scope="room_shared_claim",
        )

    selected_by_student: dict[str, list[ReasonCandidate]] = {}
    for student_id in sorted(context.student_ids):
        aggregated = aggregate_student_factors(
            student_id=student_id,
            room_student_ids=context.student_ids,
            pair_results=context.pair_results,
        )
        student_specific_candidates = build_reason_candidates(
            [item.classified for item in aggregated],
            claim_scope="student_specific_claim",
        )
        selected_student_specific = select_reason_candidates(
            context.student_labels[student_id],
            student_specific_candidates,
        )

        if room_shared_candidates:
            selected_room_shared = select_reason_candidates(
                context.student_labels[student_id],
                room_shared_candidates,
                max_reasons=1,
            )
            selected = _merge_reason_candidates(
                selected_room_shared,
                selected_student_specific,
                max_reasons=MAX_REASONS,
            )
        else:
            selected = selected_student_specific

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
        student_id: student_satisfaction[student_id] < OKAY_THRESHOLD
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
