from __future__ import annotations

from app.services.matching.errors import SegmentValidationError


def assign_room_ids(
    segment_key: str,
    room_size: int,
    rooms: list[list[str]],
    provided_room_ids: list[str] | None,
) -> list[tuple[str, list[str]]]:
    normalized_rooms = [sorted(room) for room in rooms]
    normalized_rooms.sort()
    room_count = len(normalized_rooms)

    if provided_room_ids is not None:
        if len(provided_room_ids) != room_count:
            raise SegmentValidationError(
                f"Provided room id count {len(provided_room_ids)} does not match room count {room_count}"
            )
        if len(set(provided_room_ids)) != len(provided_room_ids):
            raise SegmentValidationError("Provided room ids must be unique")
        # Intentionally sort caller-provided IDs so room assignment is deterministic.
        room_ids = sorted(provided_room_ids)
    else:
        room_ids = [f"{segment_key}_R{room_size}_{idx + 1:03d}" for idx in range(room_count)]

    assignments = list(zip(room_ids, normalized_rooms, strict=True))
    assignments.sort(key=lambda item: item[0])
    return assignments
