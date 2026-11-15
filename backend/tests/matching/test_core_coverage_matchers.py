from __future__ import annotations

import networkx as nx
import pytest

from app.services.matching import matcher_2bed, matcher_3bed, matcher_4bed
from app.services.matching.errors import (
    MatchingConstructionError,
    SegmentValidationError,
)
from app.services.matching.matcher_2bed import match_2bed
from app.services.matching.matcher_3bed import _best_candidate, _unit_priority, match_3bed
from app.services.matching.matcher_4bed import match_4bed
from tests.matching.fixtures import build_pair_results


def test_match_2bed_rejects_wrong_pair_count_from_collaborator(monkeypatch: pytest.MonkeyPatch) -> None:
    students = ["A", "B", "C", "D"]
    pair_results = build_pair_results(students, default_score=0.6)
    monkeypatch.setattr(nx, "max_weight_matching", lambda *args, **kwargs: {("A", "B")})

    with pytest.raises(MatchingConstructionError, match="returned 1 pairs, expected 2"):
        match_2bed(students, pair_results)


def test_match_2bed_rejects_collaborator_that_drops_a_student(monkeypatch: pytest.MonkeyPatch) -> None:
    students = ["A", "B", "C", "D"]
    pair_results = build_pair_results(students, default_score=0.6)
    monkeypatch.setattr(
        nx,
        "max_weight_matching",
        lambda *args, **kwargs: {("A", "B"), ("C", "X")},
    )

    with pytest.raises(MatchingConstructionError, match="did not assign each student exactly once"):
        match_2bed(students, pair_results)


def test_best_candidate_returns_none_for_empty_pool() -> None:
    assert _best_candidate(["A"], [], {}) is None


def test_unit_priority_marks_unit_unfillable_when_pool_is_too_small() -> None:
    assert _unit_priority(("A", "B"), {"A", "B"}, {}) == (10**9, 10.0, ("A", "B"))


def test_match_3bed_rejects_multiple_leftover_students(monkeypatch: pytest.MonkeyPatch) -> None:
    students = ["A", "B", "C", "D", "E", "F"]
    pair_results = build_pair_results(students, default_score=0.6)
    monkeypatch.setattr(nx, "max_weight_matching", lambda *args, **kwargs: set())

    with pytest.raises(MatchingConstructionError, match="more than one leftover student"):
        match_3bed(students, pair_results)


def test_match_3bed_falls_back_when_all_seed_units_are_partially_consumed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    students = ["A", "B", "C", "D", "E", "F"]
    overrides = {
        ("A", "E"): 0.9,
        ("B", "E"): 0.9,
        ("C", "E"): 0.9,
        ("D", "E"): 0.9,
        ("A", "F"): 0.4,
        ("B", "F"): 0.4,
        ("C", "F"): 0.4,
        ("D", "F"): 0.4,
    }
    pair_results = build_pair_results(students, default_score=0.6, score_overrides=overrides)
    monkeypatch.setattr(
        matcher_3bed,
        "map_blossom_matching",
        lambda raw_matching: [("A", "B", "C", "D"), ("E", "F")],
    )

    rooms = match_3bed(students, pair_results)

    assert sorted(student for room in rooms for student in room) == students
    assert [len(room) for room in rooms] == [3, 3]
    assert ("A", "E", "F") in {tuple(room) for room in rooms}


def test_match_3bed_reports_unable_to_complete_room(monkeypatch: pytest.MonkeyPatch) -> None:
    students = ["A", "B", "C", "D", "E", "F"]
    pair_results = build_pair_results(students, default_score=0.6)
    monkeypatch.setattr(
        matcher_3bed,
        "map_blossom_matching",
        lambda raw_matching: [("A", "B", "C", "D"), ("E", "F")],
    )

    with pytest.raises(MatchingConstructionError, match="Unable to complete a 3-bed room"):
        match_3bed(students, pair_results)


def test_match_3bed_reports_room_count_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    students = [f"S{index}" for index in range(1, 10)]
    pair_results = build_pair_results(students, default_score=0.6)
    monkeypatch.setattr(
        matcher_3bed,
        "map_blossom_matching",
        lambda raw_matching: [("S1", "S2", "S3", "S4"), ("S5", "S6", "S7", "S8", "S9")],
    )

    with pytest.raises(MatchingConstructionError, match="returned 2 rooms, expected 3"):
        match_3bed(students, pair_results)


def test_match_4bed_rejects_non_divisible_student_count() -> None:
    with pytest.raises(SegmentValidationError, match="divisible by 4"):
        match_4bed(["A", "B", "C", "D", "E", "F"], {})


def test_match_4bed_rejects_final_unmergeable_pair(monkeypatch: pytest.MonkeyPatch) -> None:
    students = ["A", "B", "C", "D"]
    pair_results = build_pair_results(students, default_score=0.6)
    monkeypatch.setattr(matcher_4bed, "match_2bed", lambda ids, results: [("A", "B")])

    with pytest.raises(MatchingConstructionError, match="cannot merge final pair"):
        match_4bed(students, pair_results)


def test_match_4bed_rejects_wrong_room_count(monkeypatch: pytest.MonkeyPatch) -> None:
    students = ["A", "B", "C", "D", "E", "F", "G", "H"]
    pair_results = build_pair_results(students, default_score=0.6)
    monkeypatch.setattr(
        matcher_4bed,
        "match_2bed",
        lambda ids, results: [("A", "B"), ("C", "D")],
    )

    with pytest.raises(MatchingConstructionError, match="returned 1 rooms, expected 2"):
        match_4bed(students, pair_results)


def test_match_4bed_rejects_assignment_of_unknown_student(monkeypatch: pytest.MonkeyPatch) -> None:
    students = ["A", "B", "C", "D", "E", "F", "G", "H"]
    pair_results = build_pair_results([*students, "X", "Y"], default_score=0.6)
    monkeypatch.setattr(
        matcher_4bed,
        "match_2bed",
        lambda ids, results: [("A", "B"), ("C", "D"), ("E", "F"), ("X", "Y")],
    )

    with pytest.raises(MatchingConstructionError, match="did not assign each student exactly once"):
        match_4bed(students, pair_results)
