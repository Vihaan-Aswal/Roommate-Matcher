from __future__ import annotations

import pytest

from app.services.matching.errors import InvariantViolationError
from app.services.matching.invariants import validate_room_assignments


def test_validate_room_assignments_passes_for_valid_partition() -> None:
    validate_room_assignments(
        student_ids=["A", "B", "C", "D"],
        rooms=[["A", "B"], ["C", "D"]],
        room_size=2,
    )


def test_validate_room_assignments_rejects_duplicate_assignment() -> None:
    with pytest.raises(InvariantViolationError):
        validate_room_assignments(
            student_ids=["A", "B", "C", "D"],
            rooms=[["A", "B"], ["B", "D"]],
            room_size=2,
        )


def test_validate_room_assignments_rejects_dropped_student() -> None:
    with pytest.raises(InvariantViolationError):
        validate_room_assignments(
            student_ids=["A", "B", "C", "D"],
            rooms=[["A", "B"], ["C", "E"]],
            room_size=2,
        )
