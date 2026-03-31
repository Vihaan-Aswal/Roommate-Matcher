from __future__ import annotations

import pytest

from app.services.matching.errors import IncompletePairMatrixError, SegmentValidationError
from app.services.matching.matcher_3bed import match_3bed
from app.services.matching.pair_lookup import normalize_and_validate_pair_results
from tests.matching.fixtures import build_pair_results, three_bed_leftover_solo


def test_match_3bed_handles_leftover_solo_and_assigns_full_coverage() -> None:
    segment = three_bed_leftover_solo()
    pair_results = normalize_and_validate_pair_results(segment.student_ids, segment.pair_results)

    rooms = match_3bed(segment.student_ids, pair_results)

    assert len(rooms) == 3
    assert all(len(room) == 3 for room in rooms)
    assert sorted(student for room in rooms for student in room) == sorted(segment.student_ids)


def test_match_3bed_processes_constrained_unit_first() -> None:
    students = ["A", "B", "C", "D", "E", "F"]
    overrides = {
        ("A", "B"): 0.95,
        ("C", "D"): 0.94,
        ("E", "F"): 0.93,
        ("A", "C"): 0.86,
        ("B", "C"): 0.85,
        ("C", "E"): 0.80,
        ("C", "F"): 0.80,
        ("D", "E"): 0.80,
        ("D", "F"): 0.80,
    }
    pair_results = normalize_and_validate_pair_results(
        students,
        build_pair_results(students, default_score=0.20, score_overrides=overrides),
    )

    rooms = match_3bed(students, pair_results)
    room_set = {tuple(room) for room in rooms}

    assert ("A", "B", "C") in room_set


def test_match_3bed_rejects_non_divisible_student_count() -> None:
    students = ["S01", "S02", "S03", "S04"]
    pair_results = normalize_and_validate_pair_results(students, build_pair_results(students, default_score=0.6))

    with pytest.raises(SegmentValidationError):
        match_3bed(students, pair_results)


def test_match_3bed_fails_cleanly_when_pair_matrix_is_incomplete() -> None:
    students = ["S01", "S02", "S03", "S04", "S05", "S06"]
    pair_results = build_pair_results(students, default_score=0.6)
    pair_results.pop(("S01", "S02"))

    with pytest.raises(IncompletePairMatrixError):
        match_3bed(students, pair_results)
