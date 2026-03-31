from __future__ import annotations

import hashlib

from app.services.explainability.contracts import HypotheticalGroupInput, RoomExplanationContext
from app.services.explainability.service import (
    explain_hypothetical_group,
    generate_explanation,
    generate_room_explanations,
)
from app.services.matching.labels import classify_student
from app.services.matching.satisfaction import compute_student_satisfaction_scores

from .conftest import build_pair_results


def _hypothetical_room_id(segment_key: str, room_size: int, student_ids: list[str]) -> str:
    payload = "|".join(sorted(student_ids))
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:8]
    return f"{segment_key}_HYP_{room_size}_{digest}"


def test_generate_explanation_matches_room_explanations_for_student() -> None:
    students = ["S01", "S02"]
    pair_results = build_pair_results(
        students,
        pair_factor_overrides={("S01", "S02"): {"q1_enc": 0.91, "q2_enc": 0.88, "q9_enc": 0.74}},
        pair_score_overrides={("S01", "S02"): 0.84},
    )

    context = RoomExplanationContext(
        segment_key="SEG_WRAP",
        room_id="SEG_WRAP_ROOM_001",
        room_size=2,
        student_ids=students,
        pair_results=pair_results,
        student_satisfaction={"S01": 0.84, "S02": 0.84},
        student_labels={"S01": "Good", "S02": "Good"},
        student_at_risk={"S01": False, "S02": False},
        reason_mode="assigned_room",
    )

    room_explanations = generate_room_explanations(context)
    expected = {item.student_id: item.reasons for item in room_explanations}

    assert generate_explanation("S01", context) == expected["S01"]
    assert generate_explanation("S02", context) == expected["S02"]


def test_assigned_and_hypothetical_paths_produce_matching_reasons() -> None:
    students = ["H01", "H02", "H03"]
    pair_results = build_pair_results(
        students,
        pair_factor_overrides={
            ("H01", "H02"): {"q1_enc": 0.92, "q2_enc": 0.87, "q9_enc": 0.74},
            ("H01", "H03"): {"q1_enc": 0.82, "q2_enc": 0.78, "q9_enc": 0.68},
            ("H02", "H03"): {"q1_enc": 0.79, "q2_enc": 0.81, "q9_enc": 0.63},
        },
    )

    scores = compute_student_satisfaction_scores(students, pair_results)
    labels: dict[str, str] = {}
    at_risk: dict[str, bool] = {}
    for student_id in students:
        roommates = [roommate for roommate in students if roommate != student_id]
        label, _, is_at_risk = classify_student(
            student_id=student_id,
            roommate_ids=roommates,
            satisfaction_score=scores[student_id],
            pair_results=pair_results,
        )
        labels[student_id] = label
        at_risk[student_id] = is_at_risk

    room_id = _hypothetical_room_id("SEG_H", 3, students)
    assigned_context = RoomExplanationContext(
        segment_key="SEG_H",
        room_id=room_id,
        room_size=3,
        student_ids=students,
        pair_results=pair_results,
        student_satisfaction=scores,
        student_labels=labels,
        student_at_risk=at_risk,
        reason_mode="assigned_room",
    )

    assigned = generate_room_explanations(assigned_context)
    hypothetical = explain_hypothetical_group(
        HypotheticalGroupInput(
            segment_key="SEG_H",
            room_size=3,
            student_ids=students,
            pair_results=pair_results,
            precomputed_satisfaction=scores,
            precomputed_labels=labels,
        )
    )

    assigned_reasons = {item.student_id: item.reasons for item in assigned}
    hypothetical_reasons = {item.student_id: item.reasons for item in hypothetical}

    assert assigned_reasons == hypothetical_reasons


def test_three_bed_traces_include_both_claim_scopes() -> None:
    students = ["T01", "T02", "T03"]
    pair_results = build_pair_results(
        students,
        default_factor_score=0.72,
        pair_factor_overrides={
            ("T01", "T02"): {"q1_enc": 0.70, "q2_enc": 0.95, "q9_enc": 0.78},
            ("T01", "T03"): {"q1_enc": 0.70, "q2_enc": 0.95, "q9_enc": 0.78},
            ("T02", "T03"): {"q1_enc": 0.93, "q2_enc": 0.35, "q9_enc": 0.62},
        },
    )

    context = RoomExplanationContext(
        segment_key="SEG_SCOPE_3",
        room_id="SEG_SCOPE_3_ROOM_001",
        room_size=3,
        student_ids=students,
        pair_results=pair_results,
        student_satisfaction={"T01": 0.78, "T02": 0.74, "T03": 0.74},
        student_labels={"T01": "Good", "T02": "Good", "T03": "Good"},
        student_at_risk={"T01": False, "T02": False, "T03": False},
        reason_mode="assigned_room",
    )

    explanations = generate_room_explanations(context)

    assert any(
        {"room_shared_claim", "student_specific_claim"}.issubset(
            {trace["claim_scope"] for trace in explanation.factor_trace}
        )
        for explanation in explanations
    )


def test_four_bed_traces_include_both_claim_scopes() -> None:
    students = ["F01", "F02", "F03", "F04"]
    pair_results = build_pair_results(
        students,
        default_factor_score=0.70,
        pair_factor_overrides={
            ("F01", "F02"): {"q1_enc": 0.70, "q2_enc": 0.95, "q9_enc": 0.79},
            ("F01", "F03"): {"q1_enc": 0.70, "q2_enc": 0.95, "q9_enc": 0.79},
            ("F01", "F04"): {"q1_enc": 0.70, "q2_enc": 0.95, "q9_enc": 0.79},
            ("F02", "F03"): {"q1_enc": 0.92, "q2_enc": 0.30, "q9_enc": 0.60},
            ("F02", "F04"): {"q1_enc": 0.92, "q2_enc": 0.30, "q9_enc": 0.60},
            ("F03", "F04"): {"q1_enc": 0.92, "q2_enc": 0.30, "q9_enc": 0.60},
        },
    )

    context = RoomExplanationContext(
        segment_key="SEG_SCOPE_4",
        room_id="SEG_SCOPE_4_ROOM_001",
        room_size=4,
        student_ids=students,
        pair_results=pair_results,
        student_satisfaction={"F01": 0.77, "F02": 0.73, "F03": 0.73, "F04": 0.73},
        student_labels={"F01": "Good", "F02": "Good", "F03": "Good", "F04": "Good"},
        student_at_risk={"F01": False, "F02": False, "F03": False, "F04": False},
        reason_mode="assigned_room",
    )

    explanations = generate_room_explanations(context)

    assert any(
        {"room_shared_claim", "student_specific_claim"}.issubset(
            {trace["claim_scope"] for trace in explanation.factor_trace}
        )
        for explanation in explanations
    )
