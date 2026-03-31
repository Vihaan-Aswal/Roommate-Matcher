from __future__ import annotations

from dataclasses import asdict
from pathlib import Path

from app.services.explainability.consistency import enforce_room_consistency
from app.services.explainability.contracts import RoomExplanationContext
from app.services.explainability.factor_classification import classify_factor
from app.services.explainability.privacy_rules import blocked_sensitive_lexicon
from app.services.explainability.reason_selection import ReasonCandidate, build_reason_candidates, select_reason_candidates
from app.services.explainability.service import generate_room_explanations
from app.services.explainability.template_renderer import render_reason_lines
from app.services.fairness.distribution import compute_fairness_distribution
from app.services.matching.contracts import SegmentData
from app.services.matching.engine import run_matching_for_segment

from .conftest import build_pair_results


def _explanations_from_matching(matching_result, pair_results, segment_key: str):
    student_lookup = {student.student_id: student for student in matching_result.students}
    all_explanations: dict[str, list[str]] = {}

    for room in matching_result.rooms:
        room_students = [student_lookup[student_id] for student_id in room.student_ids]
        context = RoomExplanationContext(
            segment_key=segment_key,
            room_id=room.room_id,
            room_size=room.room_size,
            student_ids=room.student_ids,
            pair_results=pair_results,
            student_satisfaction={student.student_id: student.satisfaction_score for student in room_students},
            student_labels={student.student_id: student.satisfaction_label for student in room_students},
            student_at_risk={student.student_id: student.is_at_risk for student in room_students},
            reason_mode="assigned_room",
        )
        for explanation in generate_room_explanations(context):
            all_explanations[explanation.student_id] = explanation.reasons

    return dict(sorted(all_explanations.items()))


def test_deterministic_reruns_produce_identical_explanations_and_fairness() -> None:
    students = ["D01", "D02", "D03", "D04"]
    pair_results = build_pair_results(
        students,
        default_factor_score=0.68,
        pair_factor_overrides={
            ("D01", "D02"): {"q1_enc": 0.90, "q2_enc": 0.88},
            ("D03", "D04"): {"q1_enc": 0.89, "q2_enc": 0.86},
            ("D01", "D03"): {"q1_enc": 0.42},
            ("D02", "D04"): {"q1_enc": 0.40},
        },
    )

    segment = SegmentData(
        segment_key="SEG_DET",
        room_size=2,
        student_ids=students,
        pair_results=pair_results,
        room_ids=None,
        metadata={"fixture": "determinism_regression"},
    )

    first = run_matching_for_segment(segment)
    second = run_matching_for_segment(segment)

    first_explanations = _explanations_from_matching(first, pair_results, "SEG_DET")
    second_explanations = _explanations_from_matching(second, pair_results, "SEG_DET")

    assert first_explanations == second_explanations

    fairness_input_first = [
        {
            "student_id": student.student_id,
            "segment_key": "SEG_DET",
            "satisfaction_score": student.satisfaction_score,
            "satisfaction_label": student.satisfaction_label,
            "is_at_risk": student.is_at_risk,
        }
        for student in first.students
    ]
    fairness_input_second = [
        {
            "student_id": student.student_id,
            "segment_key": "SEG_DET",
            "satisfaction_score": student.satisfaction_score,
            "satisfaction_label": student.satisfaction_label,
            "is_at_risk": student.is_at_risk,
        }
        for student in second.students
    ]

    first_fairness = asdict(compute_fairness_distribution(fairness_input_first))
    second_fairness = asdict(compute_fairness_distribution(fairness_input_second))

    assert first_fairness == second_fairness


def test_explainability_and_fairness_modules_do_not_import_api_or_orm_layers() -> None:
    backend_root = Path(__file__).resolve().parents[2]
    explainability_dir = backend_root / "app" / "services" / "explainability"
    fairness_dir = backend_root / "app" / "services" / "fairness"

    for module_dir in (explainability_dir, fairness_dir):
        for module_path in module_dir.glob("*.py"):
            module_text = module_path.read_text(encoding="utf-8").lower()
            assert "fastapi" not in module_text
            assert "sqlalchemy" not in module_text


def test_rendered_explanations_respect_sensitive_term_blacklist() -> None:
    students = ["P01", "P02"]
    pair_results = build_pair_results(
        students,
        default_factor_score=0.35,
        pair_factor_overrides={
            ("P01", "P02"): {
                "q6_enc": 0.00,
                "q7_enc": 0.00,
                "q8_enc": 0.00,
                "q1_enc": 0.68,
                "q2_enc": 0.42,
            }
        },
        pair_score_overrides={("P01", "P02"): 0.45},
    )

    context = RoomExplanationContext(
        segment_key="SEG_PRIV",
        room_id="SEG_PRIV_ROOM_001",
        room_size=2,
        student_ids=students,
        pair_results=pair_results,
        student_satisfaction={"P01": 0.45, "P02": 0.45},
        student_labels={"P01": "Poor", "P02": "Poor"},
        student_at_risk={"P01": True, "P02": True},
        reason_mode="assigned_room",
    )

    explanations = generate_room_explanations(context)
    rendered_text = " ".join(
        reason
        for explanation in explanations
        for reason in explanation.reasons
    ).lower()

    for blocked_term in blocked_sensitive_lexicon:
        assert blocked_term not in rendered_text


def test_contradiction_scoping_preserves_student_specific_claims() -> None:
    shared_positive = ReasonCandidate(
        factor_key="q1_enc",
        reason_bucket="sleep_alignment",
        factor_class="Strong Match",
        polarity="strong_positive",
        raw_score=0.92,
        weight_used=0.20,
        claim_scope="room_shared_claim",
        missing_data=False,
    )
    shared_mismatch = ReasonCandidate(
        factor_key="q1_enc",
        reason_bucket="sleep_alignment",
        factor_class="Strong Mismatch",
        polarity="mismatch",
        raw_score=0.12,
        weight_used=0.20,
        claim_scope="room_shared_claim",
        missing_data=False,
    )
    student_specific_mismatch = ReasonCandidate(
        factor_key="q1_enc",
        reason_bucket="sleep_alignment",
        factor_class="Strong Mismatch",
        polarity="mismatch",
        raw_score=0.18,
        weight_used=0.20,
        claim_scope="student_specific_claim",
        missing_data=False,
    )

    resolved = enforce_room_consistency(
        {
            "S01": [shared_positive, student_specific_mismatch],
            "S02": [shared_mismatch],
        }
    )

    assert any(item is student_specific_mismatch for item in resolved["S01"])
    assert not any(
        item.claim_scope == "room_shared_claim" and item.factor_class == "Strong Mismatch"
        for item in resolved["S02"]
    )


def test_strong_mismatch_outranks_moderate_mismatch_in_rendered_output() -> None:
    classified_factors = [
        classify_factor("q1_enc", 0.91, weight_used=0.20, missing_data=False),
        classify_factor("q2_enc", 0.10, weight_used=0.15, missing_data=False),
        classify_factor("q3_enc", 0.30, weight_used=0.10, missing_data=False),
    ]
    selected = select_reason_candidates("Poor", build_reason_candidates(classified_factors))

    _, traces = render_reason_lines(
        student_id="RANK_01",
        room_id="ROOM_RANK_01",
        selected_candidates=selected,
    )

    mismatch_classes = [
        trace.factor_class
        for trace in traces
        if trace.factor_class in {"Strong Mismatch", "Moderate Mismatch"}
    ]
    assert mismatch_classes[:2] == ["Strong Mismatch", "Moderate Mismatch"]
