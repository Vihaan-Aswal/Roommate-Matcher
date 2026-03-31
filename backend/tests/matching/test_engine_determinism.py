from __future__ import annotations

from pathlib import Path

from app.services.matching.contracts import SegmentData
from app.services.matching.engine import run_matching_for_segment
from tests.matching.fixtures import (
    adversarial_swap_improves_minimum,
    clean_2bed_clear_optimum,
    determinism_tie_pressure,
    four_bed_ambiguous_pair_merges,
    three_bed_leftover_solo,
    uniformly_weak_segment,
)


def test_run_matching_for_segment_is_identical_across_repeated_runs() -> None:
    segment = determinism_tie_pressure()

    result_first = run_matching_for_segment(segment)
    result_second = run_matching_for_segment(segment)

    assert result_first == result_second


def test_run_matching_for_segment_is_stable_for_shuffled_input_students() -> None:
    segment = determinism_tie_pressure()
    shuffled_segment = SegmentData(
        segment_key=segment.segment_key,
        room_size=segment.room_size,
        student_ids=list(reversed(segment.student_ids)),
        room_ids=segment.room_ids,
        pair_results=segment.pair_results,
        metadata=segment.metadata,
    )

    baseline = run_matching_for_segment(segment)
    shuffled = run_matching_for_segment(shuffled_segment)

    assert baseline == shuffled


def test_run_matching_for_segment_generates_deterministic_room_ids_when_absent() -> None:
    segment = determinism_tie_pressure()

    result = run_matching_for_segment(segment)
    room_ids = [room.room_id for room in result.rooms]

    assert room_ids == sorted(room_ids)
    assert len(set(room_ids)) == len(room_ids)
    assert all(room_id.startswith(f"{segment.segment_key}_R{segment.room_size}_") for room_id in room_ids)


def test_uniformly_weak_segment_surfaces_at_risk_students() -> None:
    segment = uniformly_weak_segment()

    result = run_matching_for_segment(segment)

    assert len(result.at_risk_student_ids) == len(segment.student_ids)
    assert result.label_counts["Poor"] == len(segment.student_ids)


def test_all_phase3_fixtures_assign_full_coverage_without_duplicates() -> None:
    fixtures = [
        clean_2bed_clear_optimum(),
        three_bed_leftover_solo(),
        four_bed_ambiguous_pair_merges(),
        adversarial_swap_improves_minimum(),
        uniformly_weak_segment(),
        determinism_tie_pressure(),
    ]

    for segment in fixtures:
        result = run_matching_for_segment(segment)
        assigned_students = [student_id for room in result.rooms for student_id in room.student_ids]
        assert sorted(assigned_students) == sorted(segment.student_ids)
        assert len(assigned_students) == len(set(assigned_students))


def test_matching_core_has_no_fastapi_or_sqlalchemy_imports() -> None:
    matching_dir = Path(__file__).resolve().parents[2] / "app" / "services" / "matching"
    forbidden_imports = (
        "import fastapi",
        "from fastapi import",
        "import sqlalchemy",
        "from sqlalchemy import",
        "from sqlalchemy.orm import",
    )

    for module_path in matching_dir.glob("*.py"):
        module_contents = module_path.read_text(encoding="utf-8").lower()
        for forbidden_import in forbidden_imports:
            assert forbidden_import not in module_contents
