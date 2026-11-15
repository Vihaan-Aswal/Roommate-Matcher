from __future__ import annotations

import pytest

from app.services.matching.errors import (
    IncompletePairMatrixError,
    InvalidMatchingOutputError,
    InvalidPairMatrixError,
    SegmentValidationError,
)
from app.services.matching.nx_mapping import map_blossom_matching
from app.services.matching.pair_lookup import (
    canonical_pair,
    normalize_and_validate_pair_results,
)
from app.services.matching.room_ids import assign_room_ids
from tests.matching.fixtures import build_pair_results, make_pair_result


def test_canonical_pair_rejects_self_edge() -> None:
    with pytest.raises(InvalidPairMatrixError, match="Self edge is not allowed"):
        canonical_pair("A", "A")


def test_normalize_rejects_empty_student_ids() -> None:
    with pytest.raises(SegmentValidationError, match="student_ids must be non-empty"):
        normalize_and_validate_pair_results([], {})


def test_normalize_rejects_duplicate_student_ids() -> None:
    with pytest.raises(SegmentValidationError, match="student_ids must be unique"):
        normalize_and_validate_pair_results(["A", "A"], {})


def test_normalize_rejects_pair_key_that_is_not_a_two_tuple() -> None:
    with pytest.raises(InvalidPairMatrixError, match="Invalid pair key shape"):
        normalize_and_validate_pair_results(["A", "B"], {"AB": make_pair_result(0.5)})


def test_normalize_rejects_pair_key_with_unknown_student() -> None:
    with pytest.raises(InvalidPairMatrixError, match="Unknown student in pair key"):
        normalize_and_validate_pair_results(
            ["A", "B"],
            {
                ("A", "B"): make_pair_result(0.5),
                ("A", "Z"): make_pair_result(0.5),
            },
        )


def test_normalize_rejects_duplicate_pair_edge() -> None:
    with pytest.raises(InvalidPairMatrixError, match="Duplicate pair edge detected"):
        normalize_and_validate_pair_results(
            ["A", "B"],
            {
                ("A", "B"): make_pair_result(0.5),
                ("B", "A"): make_pair_result(0.6),
            },
        )


def test_normalize_rejects_pair_score_above_range() -> None:
    with pytest.raises(InvalidPairMatrixError, match="Pair score out of range"):
        normalize_and_validate_pair_results(
            ["A", "B"],
            {("A", "B"): make_pair_result(1.5)},
        )


def test_normalize_rejects_pair_score_below_range() -> None:
    with pytest.raises(InvalidPairMatrixError, match="Pair score out of range"):
        normalize_and_validate_pair_results(
            ["A", "B"],
            {("A", "B"): make_pair_result(-0.1)},
        )


def test_normalize_reports_missing_edges() -> None:
    with pytest.raises(IncompletePairMatrixError):
        normalize_and_validate_pair_results(
            ["A", "B", "C"],
            {("A", "B"): make_pair_result(0.5)},
        )


def test_map_blossom_matching_rejects_non_sequence_item() -> None:
    with pytest.raises(InvalidMatchingOutputError, match="Invalid matching item type"):
        map_blossom_matching([42])


def test_map_blossom_matching_rejects_non_string_students() -> None:
    with pytest.raises(InvalidMatchingOutputError, match="must be strings"):
        map_blossom_matching([("A", 1)])


def test_assign_room_ids_rejects_wrong_provided_count() -> None:
    with pytest.raises(SegmentValidationError, match="does not match room count"):
        assign_room_ids(
            segment_key="SEG",
            room_size=2,
            rooms=[["A", "B"]],
            provided_room_ids=["R1", "R2"],
        )


def test_assign_room_ids_rejects_duplicate_provided_ids() -> None:
    with pytest.raises(SegmentValidationError, match="Provided room ids must be unique"):
        assign_room_ids(
            segment_key="SEG",
            room_size=2,
            rooms=[["A", "B"], ["C", "D"]],
            provided_room_ids=["R1", "R1"],
        )


def test_assign_room_ids_sorts_provided_ids_and_rooms() -> None:
    assignments = assign_room_ids(
        segment_key="SEG",
        room_size=2,
        rooms=[["C", "D"], ["A", "B"]],
        provided_room_ids=["R2", "R1"],
    )

    assert assignments == [("R1", ["A", "B"]), ("R2", ["C", "D"])]


def test_build_pair_results_fixture_covers_every_canonical_edge() -> None:
    pair_results = normalize_and_validate_pair_results(
        ["B", "A"],
        build_pair_results(["A", "B"], default_score=0.5),
    )

    assert list(pair_results) == [("A", "B")]
