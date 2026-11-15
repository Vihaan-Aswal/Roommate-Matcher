from __future__ import annotations

import pytest

from app.services.matching.errors import InvariantViolationError
from app.services.matching.invariants import validate_room_assignments


def test_validate_room_assignments_rejects_wrong_room_count() -> None:
    with pytest.raises(InvariantViolationError, match="Expected 2 rooms"):
        validate_room_assignments(
            student_ids=["A", "B", "C", "D"],
            rooms=[["A", "B"]],
            room_size=2,
        )


def test_validate_room_assignments_rejects_wrong_room_size() -> None:
    with pytest.raises(InvariantViolationError, match="Room size mismatch"):
        validate_room_assignments(
            student_ids=["A", "B", "C", "D"],
            rooms=[["A"], ["B", "C", "D"]],
            room_size=2,
        )


def test_validate_room_assignments_rejects_duplicate_student_inside_room() -> None:
    with pytest.raises(InvariantViolationError, match="Duplicate student in room"):
        validate_room_assignments(
            student_ids=["A", "B", "C", "D"],
            rooms=[["A", "A"], ["B", "C"]],
            room_size=2,
        )


def test_validate_room_assignments_rejects_assigned_count_mismatch() -> None:
    with pytest.raises(InvariantViolationError, match="Mismatch in assigned student count"):
        validate_room_assignments(
            student_ids=["A", "B", "C"],
            rooms=[["A", "B"]],
            room_size=2,
        )
