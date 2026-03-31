from __future__ import annotations

from app.services.matching.errors import InvariantViolationError


def validate_room_assignments(
    student_ids: list[str],
    rooms: list[list[str]],
    room_size: int,
) -> None:
    ordered_students = sorted(student_ids)
    expected_room_count = len(ordered_students) // room_size
    if len(rooms) != expected_room_count:
        raise InvariantViolationError(
            f"Expected {expected_room_count} rooms for size {room_size}, got {len(rooms)}"
        )

    assigned_students: list[str] = []
    for room in rooms:
        if len(room) != room_size:
            raise InvariantViolationError(f"Room size mismatch. Expected {room_size}, got {len(room)}")
        if len(set(room)) != len(room):
            raise InvariantViolationError(f"Duplicate student in room: {room}")
        assigned_students.extend(room)

    if len(assigned_students) != len(ordered_students):
        raise InvariantViolationError("Mismatch in assigned student count")

    if len(set(assigned_students)) != len(assigned_students):
        raise InvariantViolationError("A student was assigned to multiple rooms")

    if sorted(assigned_students) != ordered_students:
        raise InvariantViolationError("Assigned students do not exactly match segment students")
