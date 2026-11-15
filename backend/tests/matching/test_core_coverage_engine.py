from __future__ import annotations

from dataclasses import dataclass

import pytest

from app.services.matching.contracts import SegmentData
from app.services.matching.engine import (
    _coerce_segment_data,
    _dispatch_matcher,
    _validate_segment_data,
    run_matching_for_segment,
)
from app.services.matching.errors import SegmentValidationError
from app.services.scoring.types import PairResult
from tests.matching.fixtures import build_pair_results


@dataclass(frozen=True)
class _SegmentDataLike:
    segment_key: str
    room_size: int
    student_ids: list[str]
    pair_results: dict[tuple[str, str], PairResult]
    room_ids: list[str] | None = None
    metadata: dict[str, str] | None = None


def _segment(
    students: list[str],
    *,
    room_size: int = 2,
    room_ids: list[str] | None = None,
) -> SegmentData:
    return SegmentData(
        segment_key="SEG_COVER",
        room_size=room_size,
        student_ids=students,
        pair_results=build_pair_results(students, default_score=0.6),
        room_ids=room_ids,
    )


def test_coerce_segment_data_accepts_foreign_dataclass() -> None:
    payload = _SegmentDataLike(
        segment_key="SEG_DC",
        room_size=2,
        student_ids=["A", "B"],
        pair_results=build_pair_results(["A", "B"], default_score=0.7),
        metadata={"src": "dataclass"},
    )

    coerced = _coerce_segment_data(payload)

    assert isinstance(coerced, SegmentData)
    assert coerced.segment_key == "SEG_DC"
    assert coerced.student_ids == ["A", "B"]
    assert coerced.metadata == {"src": "dataclass"}


def test_coerce_segment_data_accepts_plain_dict() -> None:
    students = ["A", "B"]
    coerced = _coerce_segment_data(
        {
            "segment_key": "SEG_DICT",
            "room_size": 2,
            "student_ids": students,
            "pair_results": build_pair_results(students, default_score=0.7),
        }
    )

    assert isinstance(coerced, SegmentData)
    assert coerced.segment_key == "SEG_DICT"
    assert coerced.room_ids is None


def test_coerce_segment_data_rejects_dict_with_wrong_shape() -> None:
    with pytest.raises(SegmentValidationError, match="Invalid segment_data shape"):
        _coerce_segment_data({"segment_key": "SEG_BAD"})


def test_coerce_segment_data_rejects_unrelated_object() -> None:
    with pytest.raises(SegmentValidationError, match="must be a SegmentData instance or a dict"):
        _coerce_segment_data("not-a-segment")


def test_validate_segment_data_rejects_unsupported_room_size() -> None:
    with pytest.raises(SegmentValidationError, match="Invalid room_size"):
        _validate_segment_data(_segment(["A", "B"], room_size=5))


def test_validate_segment_data_rejects_empty_student_ids() -> None:
    with pytest.raises(SegmentValidationError, match="student_ids must be non-empty"):
        _validate_segment_data(_segment([]))


def test_validate_segment_data_rejects_duplicate_student_ids() -> None:
    with pytest.raises(SegmentValidationError, match="student_ids must be unique"):
        _validate_segment_data(_segment(["A", "A"]))


def test_validate_segment_data_rejects_room_id_count_mismatch() -> None:
    with pytest.raises(SegmentValidationError, match="does not match expected room count"):
        _validate_segment_data(_segment(["A", "B"], room_ids=["R1", "R2"]))


def test_validate_segment_data_rejects_duplicate_room_ids() -> None:
    with pytest.raises(SegmentValidationError, match="room_ids must be unique"):
        _validate_segment_data(_segment(["A", "B", "C", "D"], room_ids=["R1", "R1"]))


def test_dispatch_matcher_rejects_unsupported_room_size() -> None:
    with pytest.raises(SegmentValidationError, match="Unsupported room_size"):
        _dispatch_matcher(5, ["A"], {})


def test_run_matching_handles_segment_smaller_than_one_room() -> None:
    segment = _segment(["A", "B"], room_size=3)

    result = run_matching_for_segment(segment)

    assert len(result.rooms) == 1
    assert result.rooms[0].student_ids == ["A", "B"]
    assert result.room_size == 3
    assert sorted(student.student_id for student in result.students) == ["A", "B"]
