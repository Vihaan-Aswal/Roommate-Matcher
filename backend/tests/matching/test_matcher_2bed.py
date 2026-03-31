from __future__ import annotations

import pytest

from app.services.matching.errors import SegmentValidationError
from app.services.matching.matcher_2bed import match_2bed
from app.services.matching.pair_lookup import normalize_and_validate_pair_results
from tests.matching.fixtures import build_pair_results, clean_2bed_clear_optimum


def test_match_2bed_assigns_every_student_exactly_once() -> None:
    segment = clean_2bed_clear_optimum()
    pair_results = normalize_and_validate_pair_results(segment.student_ids, segment.pair_results)

    rooms = match_2bed(segment.student_ids, pair_results)

    assert len(rooms) == 4
    assert sorted(student for room in rooms for student in room) == sorted(segment.student_ids)
    assert all(len(room) == 2 for room in rooms)


def test_match_2bed_returns_expected_optimal_pairs_for_clear_fixture() -> None:
    segment = clean_2bed_clear_optimum()
    pair_results = normalize_and_validate_pair_results(segment.student_ids, segment.pair_results)

    rooms = match_2bed(segment.student_ids, pair_results)
    room_set = {tuple(room) for room in rooms}

    assert room_set == {
        ("S01", "S02"),
        ("S03", "S04"),
        ("S05", "S06"),
        ("S07", "S08"),
    }


def test_match_2bed_is_deterministic_for_shuffled_input_order() -> None:
    segment = clean_2bed_clear_optimum()
    pair_results = normalize_and_validate_pair_results(segment.student_ids, segment.pair_results)

    forward = match_2bed(segment.student_ids, pair_results)
    shuffled = match_2bed(list(reversed(segment.student_ids)), pair_results)

    assert forward == shuffled


def test_match_2bed_rejects_odd_student_count() -> None:
    students = ["S01", "S02", "S03", "S04", "S05"]
    pair_results = normalize_and_validate_pair_results(students, build_pair_results(students, default_score=0.5))

    with pytest.raises(SegmentValidationError):
        match_2bed(students, pair_results)
