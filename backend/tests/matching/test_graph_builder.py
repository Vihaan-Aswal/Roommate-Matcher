from __future__ import annotations

import pytest

from app.services.matching.errors import IncompletePairMatrixError, InvalidPairMatrixError
from app.services.matching.graph_builder import build_complete_graph
from app.services.matching.pair_lookup import normalize_and_validate_pair_results
from tests.matching.fixtures import build_pair_results, make_pair_result


def test_build_complete_graph_has_expected_nodes_and_edges() -> None:
    students = ["S01", "S02", "S03", "S04"]
    pair_results = normalize_and_validate_pair_results(
        students,
        build_pair_results(students, default_score=0.6),
    )

    graph = build_complete_graph(students, pair_results)

    assert graph.number_of_nodes() == 4
    assert graph.number_of_edges() == 6


def test_normalize_and_validate_pair_results_raises_for_missing_edge() -> None:
    students = ["S01", "S02", "S03", "S04"]
    pair_results = build_pair_results(students, default_score=0.6)
    pair_results.pop(("S01", "S02"))

    with pytest.raises(IncompletePairMatrixError):
        normalize_and_validate_pair_results(students, pair_results)


def test_normalize_and_validate_pair_results_rejects_unknown_student_edge() -> None:
    students = ["S01", "S02", "S03", "S04"]
    pair_results = build_pair_results(students, default_score=0.6)
    pair_results[("S01", "X99")] = make_pair_result(0.5)

    with pytest.raises(InvalidPairMatrixError):
        normalize_and_validate_pair_results(students, pair_results)


def test_build_complete_graph_uses_deterministic_tie_ranking() -> None:
    students = ["S01", "S02", "S03", "S04"]
    pair_results = normalize_and_validate_pair_results(
        students,
        build_pair_results(students, default_score=0.5),
    )

    graph = build_complete_graph(students, pair_results)

    # Equal scores stay equal for NetworkX (distinct near-tied weights made
    # blossom >300x slower); the tie rank is carried for audit and ordering.
    assert graph["S01"]["S02"]["weight"] == graph["S03"]["S04"]["weight"]
    assert graph["S01"]["S02"]["tie_rank"] > graph["S03"]["S04"]["tie_rank"]


def test_build_complete_graph_equal_scores_match_deterministically() -> None:
    from app.services.matching.matcher_2bed import match_2bed

    students = ["S01", "S02", "S03", "S04", "S05", "S06"]
    pair_results = normalize_and_validate_pair_results(
        students,
        build_pair_results(students, default_score=0.5),
    )

    forward = match_2bed(students, pair_results)
    reversed_input = match_2bed(list(reversed(students)), pair_results)

    assert forward == reversed_input
    assert sorted(student for room in forward for student in room) == students
    assert all(len(room) == 2 for room in forward)
