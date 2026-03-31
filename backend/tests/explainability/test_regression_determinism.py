from __future__ import annotations

from dataclasses import asdict
from pathlib import Path

from app.services.explainability.contracts import RoomExplanationContext
from app.services.explainability.service import generate_room_explanations
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
