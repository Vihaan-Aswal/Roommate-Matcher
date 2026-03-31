from __future__ import annotations

from math import isclose

from app.services.matching.matcher_4bed import _merge_stats, match_4bed
from app.services.matching.pair_lookup import normalize_and_validate_pair_results
from tests.matching.fixtures import build_pair_results, four_bed_ambiguous_pair_merges


def test_merge_stats_uses_all_six_pairs_for_four_bed_score() -> None:
    students = ["A", "B", "C", "D"]
    overrides = {
        ("A", "B"): 1.0,
        ("C", "D"): 0.8,
        ("A", "C"): 0.5,
        ("A", "D"): 0.5,
        ("B", "C"): 0.5,
        ("B", "D"): 0.5,
    }
    pair_results = normalize_and_validate_pair_results(
        students,
        build_pair_results(students, default_score=0.0, score_overrides=overrides),
    )

    merge_avg, merge_min, _ = _merge_stats(("A", "B"), ("C", "D"), pair_results)

    assert isclose(merge_avg, (1.0 + 0.8 + 0.5 + 0.5 + 0.5 + 0.5) / 6, rel_tol=0.0, abs_tol=1e-12)
    assert merge_min == 0.5


def test_match_4bed_is_deterministic_when_merges_have_equal_quality() -> None:
    segment = four_bed_ambiguous_pair_merges()
    pair_results = normalize_and_validate_pair_results(segment.student_ids, segment.pair_results)

    rooms_first = match_4bed(segment.student_ids, pair_results)
    rooms_second = match_4bed(list(reversed(segment.student_ids)), pair_results)

    assert rooms_first == rooms_second
    assert ("F01", "F02", "F03", "F04") in {tuple(room) for room in rooms_first}


def test_match_4bed_assigns_every_student_once_with_room_size_four() -> None:
    segment = four_bed_ambiguous_pair_merges()
    pair_results = normalize_and_validate_pair_results(segment.student_ids, segment.pair_results)

    rooms = match_4bed(segment.student_ids, pair_results)

    assert len(rooms) == 2
    assert all(len(room) == 4 for room in rooms)
    assert sorted(student for room in rooms for student in room) == sorted(segment.student_ids)
