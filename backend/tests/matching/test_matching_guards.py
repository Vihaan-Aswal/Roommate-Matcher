"""Guard-clause coverage for the matching engine, validators and helpers."""
from __future__ import annotations

from dataclasses import dataclass

import pytest

from app.services.matching.engine import (
    _coerce_segment_data,
    _dispatch_matcher,
    run_matching_for_segment,
)
from app.services.matching.errors import (
    IncompletePairMatrixError,
    InvalidMatchingOutputError,
    InvalidPairMatrixError,
    InvariantViolationError,
    SegmentValidationError,
)
from app.services.matching.invariants import validate_room_assignments
from app.services.matching.matcher_3bed import _best_candidate, _unit_priority, match_3bed
from app.services.matching.matcher_4bed import match_4bed
from app.services.matching.nx_mapping import map_blossom_matching
from app.services.matching.pair_lookup import (
    canonical_pair,
    normalize_and_validate_pair_results,
)
from app.services.matching.room_ids import assign_room_ids
from app.services.matching.swap_optimizer import _StateEvaluation, _is_better_candidate

from .fixtures import build_pair_results


@dataclass
class _SegmentDataLike:
    segment_key: str
    room_size: int
    student_ids: list[str]
    pair_results: dict
    room_ids: list[str] | None = None
    metadata: dict[str, str] | None = None


def _pair_results(students: list[str]) -> dict:
    return build_pair_results(students, default_score=0.7)


# ---------------------------------------------------------------------------
# engine: coercion, validation, dispatch, remainder rooms
# ---------------------------------------------------------------------------


def test_coerce_segment_data_accepts_dataclass_dict_and_instance() -> None:
    students = ["S1", "S2"]
    pairs = _pair_results(students)
    payload = {
        "segment_key": "SEG",
        "room_size": 2,
        "student_ids": students,
        "pair_results": pairs,
    }

    assert _coerce_segment_data(payload).segment_key == "SEG"
    assert _coerce_segment_data(_SegmentDataLike(**payload)).segment_key == "SEG"


def test_coerce_segment_data_rejects_bad_shapes() -> None:
    with pytest.raises(SegmentValidationError, match="Invalid segment_data shape"):
        _coerce_segment_data({"segment_key": "SEG", "unexpected": True})
    with pytest.raises(SegmentValidationError, match="SegmentData instance or a dict"):
        _coerce_segment_data(["not", "valid"])


def test_engine_rejects_invalid_room_size_and_student_lists() -> None:
    pairs = _pair_results(["S1", "S2"])
    with pytest.raises(SegmentValidationError, match="Invalid room_size"):
        run_matching_for_segment(
            {"segment_key": "SEG", "room_size": 5, "student_ids": ["S1", "S2"], "pair_results": pairs}
        )
    with pytest.raises(SegmentValidationError, match="student_ids must be non-empty"):
        run_matching_for_segment(
            {"segment_key": "SEG", "room_size": 2, "student_ids": [], "pair_results": {}}
        )
    with pytest.raises(SegmentValidationError, match="student_ids must be unique"):
        run_matching_for_segment(
            {"segment_key": "SEG", "room_size": 2, "student_ids": ["S1", "S1"], "pair_results": pairs}
        )


def test_engine_rejects_bad_provided_room_ids() -> None:
    students = ["S1", "S2", "S3", "S4"]
    pairs = _pair_results(students)
    with pytest.raises(SegmentValidationError, match="room_ids count"):
        run_matching_for_segment(
            {
                "segment_key": "SEG",
                "room_size": 2,
                "student_ids": students,
                "pair_results": pairs,
                "room_ids": ["R1"],
            }
        )
    with pytest.raises(SegmentValidationError, match="room_ids must be unique"):
        run_matching_for_segment(
            {
                "segment_key": "SEG",
                "room_size": 2,
                "student_ids": students,
                "pair_results": pairs,
                "room_ids": ["R1", "R1"],
            }
        )


def test_dispatch_matcher_rejects_unsupported_room_size() -> None:
    with pytest.raises(SegmentValidationError, match="Unsupported room_size"):
        _dispatch_matcher(5, ["S1"], {})


def test_engine_keeps_a_remainder_room_for_odd_student_counts() -> None:
    students = ["S1", "S2", "S3"]
    result = run_matching_for_segment(
        {
            "segment_key": "SEG_ODD",
            "room_size": 2,
            "student_ids": students,
            "pair_results": _pair_results(students),
        }
    )

    assert len(result.rooms) == 2
    sizes = sorted(len(room.student_ids) for room in result.rooms)
    assert sizes == [1, 2]
    assert sorted(student.student_id for student in result.students) == students


def test_engine_handles_a_segment_smaller_than_one_room() -> None:
    students = ["S1"]
    result = run_matching_for_segment(
        {
            "segment_key": "SEG_TINY",
            "room_size": 2,
            "student_ids": students,
            "pair_results": {},
        }
    )

    assert len(result.rooms) == 1
    assert result.rooms[0].student_ids == ["S1"]


# ---------------------------------------------------------------------------
# invariants
# ---------------------------------------------------------------------------


def test_validate_room_assignments_rejects_wrong_room_count() -> None:
    with pytest.raises(InvariantViolationError, match="Expected 2 rooms"):
        validate_room_assignments(["A", "B", "C", "D"], [["A", "B"]], 2)


def test_validate_room_assignments_rejects_room_size_and_duplicates() -> None:
    with pytest.raises(InvariantViolationError, match="Room size mismatch"):
        validate_room_assignments(["A", "B"], [["A"]], 2)
    with pytest.raises(InvariantViolationError, match="Duplicate student in room"):
        validate_room_assignments(["A", "B", "C", "D"], [["A", "A"], ["B", "C"]], 2)


def test_validate_room_assignments_rejects_wrong_student_sets() -> None:
    with pytest.raises(InvariantViolationError, match="assigned to multiple rooms"):
        validate_room_assignments(["A", "B", "C", "D"], [["A", "B"], ["A", "C"]], 2)
    with pytest.raises(InvariantViolationError, match="do not exactly match"):
        validate_room_assignments(["A", "B", "C", "D"], [["A", "B"], ["C", "X"]], 2)


# ---------------------------------------------------------------------------
# pair lookup / room ids
# ---------------------------------------------------------------------------


def test_canonical_pair_rejects_self_edges() -> None:
    with pytest.raises(InvalidPairMatrixError, match="Self edge"):
        canonical_pair("S1", "S1")


def test_normalize_pair_results_rejects_bad_inputs() -> None:
    students = ["S1", "S2"]
    good_pairs = _pair_results(students)

    with pytest.raises(SegmentValidationError, match="must be non-empty"):
        normalize_and_validate_pair_results([], {})
    with pytest.raises(SegmentValidationError, match="must be unique"):
        normalize_and_validate_pair_results(["S1", "S1"], good_pairs)
    with pytest.raises(InvalidPairMatrixError, match="Invalid pair key shape"):
        normalize_and_validate_pair_results(students, {("S1"): good_pairs[("S1", "S2")]})
    with pytest.raises(InvalidPairMatrixError, match="Unknown student"):
        normalize_and_validate_pair_results(
            students, {("S1", "GHOST"): good_pairs[("S1", "S2")]}
        )
    with pytest.raises(InvalidPairMatrixError, match="Duplicate pair edge"):
        duplicate_edges = dict(good_pairs)
        duplicate_edges[("S2", "S1")] = good_pairs[("S1", "S2")]
        normalize_and_validate_pair_results(students, duplicate_edges)


def test_normalize_pair_results_rejects_out_of_range_scores() -> None:
    students = ["S1", "S2"]
    pairs = _pair_results(students)
    pairs[("S1", "S2")] = type(pairs[("S1", "S2")])(
        pair_score=1.2,
        factor_breakdown=pairs[("S1", "S2")].factor_breakdown,
        excellent_candidate=False,
    )
    with pytest.raises(InvalidPairMatrixError, match="out of range"):
        normalize_and_validate_pair_results(students, pairs)


def test_normalize_pair_results_reports_missing_edges() -> None:
    with pytest.raises(IncompletePairMatrixError) as exc_info:
        normalize_and_validate_pair_results(["S1", "S2", "S3"], {})
    assert len(exc_info.value.missing_pairs) == 3


def test_assign_room_ids_validates_provided_ids() -> None:
    with pytest.raises(SegmentValidationError, match="Provided room id count"):
        assign_room_ids("SEG", 2, [["A", "B"]], ["R1", "R2"])
    with pytest.raises(SegmentValidationError, match="Provided room ids must be unique"):
        assign_room_ids("SEG", 2, [["A", "B"], ["C", "D"]], ["R1", "R1"])


def test_assign_room_ids_uses_provided_ids_sorted() -> None:
    assignments = assign_room_ids("SEG", 2, [["C", "D"], ["A", "B"]], ["R2", "R1"])
    assert [room_id for room_id, _ in assignments] == ["R1", "R2"]


# ---------------------------------------------------------------------------
# matcher guard clauses and blossom mapping
# ---------------------------------------------------------------------------


def test_three_bed_helpers_handle_empty_candidate_pools() -> None:
    assert _best_candidate(["A", "B"], [], {}) is None
    assert _unit_priority(("A", "B"), {"A", "B"}, {}) == (10**9, 10.0, ("A", "B"))


def test_matchers_reject_student_counts_that_do_not_fill_rooms() -> None:
    with pytest.raises(SegmentValidationError, match="divisible by 3"):
        match_3bed(["A", "B"], {})
    with pytest.raises(SegmentValidationError, match="divisible by 4"):
        match_4bed(["A", "B", "C"], {})


def test_map_blossom_matching_rejects_invalid_items() -> None:
    with pytest.raises(InvalidMatchingOutputError, match="Invalid matching item type"):
        map_blossom_matching([123])
    with pytest.raises(InvalidMatchingOutputError, match="exactly 2 students"):
        map_blossom_matching([("A", "B", "C")])
    with pytest.raises(InvalidMatchingOutputError, match="must be strings"):
        map_blossom_matching([("A", 2)])
    with pytest.raises(InvalidMatchingOutputError, match="more than one pair"):
        map_blossom_matching([("A", "B"), ("A", "C")])


# ---------------------------------------------------------------------------
# swap optimiser tie-breaks
# ---------------------------------------------------------------------------


def _evaluation(minimum: float, poor: int, total: float) -> _StateEvaluation:
    return _StateEvaluation(
        minimum_satisfaction=minimum,
        poor_count=poor,
        total_satisfaction=total,
        labels_by_student={},
    )


def test_swap_candidate_prefers_higher_minimum() -> None:
    signature = ("R1", "A", "R2", "B")
    assert _is_better_candidate(_evaluation(0.8, 0, 1.0), _evaluation(0.7, 0, 1.0), signature, signature)
    assert not _is_better_candidate(_evaluation(0.6, 0, 1.0), _evaluation(0.7, 0, 1.0), signature, signature)


def test_swap_candidate_prefers_fewer_poor_students() -> None:
    signature = ("R1", "A", "R2", "B")
    assert _is_better_candidate(_evaluation(0.7, 1, 1.0), _evaluation(0.7, 2, 1.0), signature, signature)
    assert not _is_better_candidate(_evaluation(0.7, 3, 1.0), _evaluation(0.7, 2, 1.0), signature, signature)


def test_swap_candidate_prefers_total_satisfaction_then_signature() -> None:
    better_signature = ("R1", "A", "R10", "B")
    worse_signature = ("R2", "A", "R9", "B")
    assert _is_better_candidate(_evaluation(0.7, 1, 2.0), _evaluation(0.7, 1, 1.5), better_signature, worse_signature)
    assert not _is_better_candidate(_evaluation(0.7, 1, 1.0), _evaluation(0.7, 1, 1.5), better_signature, worse_signature)
    assert _is_better_candidate(_evaluation(0.7, 1, 1.0), _evaluation(0.7, 1, 1.0), better_signature, worse_signature)
    assert not _is_better_candidate(_evaluation(0.7, 1, 1.0), _evaluation(0.7, 1, 1.0), worse_signature, better_signature)
