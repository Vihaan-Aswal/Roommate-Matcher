from __future__ import annotations

import csv
from dataclasses import dataclass, field as dc_field
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.room import Room
from app.models.segment import Segment
from app.services.ingestion.csv_utils import RowError, parse_csv_bytes, safe_text

REQUIRED_COLUMNS = {"room_id", "segment_key", "capacity"}


def _parse_capacity(value: str) -> int | None:
    text_value = value.strip()
    if not text_value.isdigit():
        return None

    capacity = int(text_value)
    if capacity not in {2, 3, 4}:
        return None

    return capacity


def _parse_csv_bytes(csv_bytes: bytes) -> csv.DictReader:
    return parse_csv_bytes(csv_bytes, REQUIRED_COLUMNS)


@dataclass
class RoomDiffResult:
    total_csv_rows: int = 0
    valid_csv_rows: int = 0
    to_insert: list[dict] = dc_field(default_factory=list)
    to_update: list[dict] = dc_field(default_factory=list)
    to_soft_delete: list[dict] = dc_field(default_factory=list)
    unchanged: list[str] = dc_field(default_factory=list)
    validation_errors: list[dict] = dc_field(default_factory=list)
    workspace_warnings: list[str] = dc_field(default_factory=list)


def plan_room_import(
    db: Session,
    workspace_id: UUID,
    tenant_id: UUID,
    csv_bytes: bytes,
) -> RoomDiffResult:
    reader = _parse_csv_bytes(csv_bytes)
    result = RoomDiffResult()

    existing_segments = {
        seg.segment_key: seg
        for seg in db.scalars(select(Segment).where(Segment.workspace_id == workspace_id)).all()
    }

    # Load existing active rooms, keyed by (segment_key, room_id)
    existing_rooms: dict[tuple[str, str], Room] = {}
    
    rows = db.execute(
        select(Room, Segment.segment_key)
        .join(Segment, Room.segment_id == Segment.id)
        .where(Room.workspace_id == workspace_id, Room.is_active == True)
    ).all()
    for room, seg_key in rows:
        existing_rooms[(seg_key, room.room_id)] = room

    seen_in_csv: set[tuple[str, str]] = set()

    for row_number, row in enumerate(reader, start=2):
        result.total_csv_rows += 1
        room_id = safe_text(row.get("room_id"))
        segment_key = safe_text(row.get("segment_key"))
        capacity_raw = safe_text(row.get("capacity"))

        row_errors: list[RowError] = []

        if not room_id:
            row_errors.append(RowError(row_number, "room_id", "required", row.get("room_id")))

        if not segment_key:
            row_errors.append(RowError(row_number, "segment_key", "required", row.get("segment_key")))

        capacity = _parse_capacity(capacity_raw)
        if capacity is None:
            row_errors.append(RowError(row_number, "capacity", "invalid_capacity", row.get("capacity")))

        segment = existing_segments.get(segment_key) if segment_key else None
        if segment_key and segment is None:
            row_errors.append(RowError(row_number, "segment_key", "unknown_segment", row.get("segment_key")))

        if segment is not None and capacity is not None and capacity != segment.room_size:
            row_errors.append(
                RowError(
                    row_number,
                    "capacity",
                    "capacity_must_match_segment_room_size",
                    row.get("capacity"),
                )
            )

        if row_errors:
            result.validation_errors.extend(e.as_dict() for e in row_errors)
            continue
            
        assert room_id is not None
        assert segment_key is not None
        assert capacity is not None

        key = (segment_key, room_id)
        if key in seen_in_csv:
            result.validation_errors.append(
                RowError(row_number, "room_id", "duplicate_room_id_in_file_for_segment", room_id).as_dict()
            )
            continue

        seen_in_csv.add(key)
        result.valid_csv_rows += 1

        if key in existing_rooms:
            room = existing_rooms[key]
            changes = {}
            if room.capacity != capacity:
                changes["capacity"] = {"old": str(room.capacity), "new": str(capacity)}
            
            if changes:
                result.to_update.append({
                    "room_id": room_id,
                    "segment_key": segment_key,
                    "action": "update",
                    "changes": changes,
                    "warnings": [],
                })
            else:
                result.unchanged.append(f"{segment_key}_{room_id}")
        else:
            result.to_insert.append({
                "room_id": room_id,
                "segment_key": segment_key,
                "action": "insert",
                "changes": None,
                "warnings": [],
            })

    for key, room in existing_rooms.items():
        if key not in seen_in_csv:
            result.to_soft_delete.append({
                "room_id": room.room_id,
                "segment_key": key[0],
                "action": "soft_delete",
                "changes": None,
                "warnings": [],
            })
            
    if result.to_soft_delete:
        result.workspace_warnings.append(
            f"Removing {len(result.to_soft_delete)} room(s) from the active inventory."
        )

    return result


@dataclass
class RoomApplyResult:
    inserted: int = 0
    updated: int = 0
    soft_deleted: int = 0
    unchanged: int = 0
    errors: list[dict] = dc_field(default_factory=list)


def apply_room_import(
    db: Session,
    workspace_id: UUID,
    tenant_id: UUID,
    csv_bytes: bytes,
) -> RoomApplyResult:
    reader = _parse_csv_bytes(csv_bytes)
    result = RoomApplyResult()

    existing_segments = {
        seg.segment_key: seg
        for seg in db.scalars(select(Segment).where(Segment.workspace_id == workspace_id)).all()
    }

    existing_rooms: dict[tuple[str, str], Room] = {}
    rows = db.execute(
        select(Room, Segment.segment_key)
        .join(Segment, Room.segment_id == Segment.id)
        .where(Room.workspace_id == workspace_id, Room.is_active == True)
    ).all()
    for room, seg_key in rows:
        existing_rooms[(seg_key, room.room_id)] = room

    seen_in_csv: set[tuple[str, str]] = set()

    for row_number, row in enumerate(reader, start=2):
        room_id = safe_text(row.get("room_id"))
        segment_key = safe_text(row.get("segment_key"))
        capacity_raw = safe_text(row.get("capacity"))

        row_errors: list[RowError] = []

        if not room_id:
            row_errors.append(RowError(row_number, "room_id", "required", row.get("room_id")))

        if not segment_key:
            row_errors.append(RowError(row_number, "segment_key", "required", row.get("segment_key")))

        capacity = _parse_capacity(capacity_raw)
        if capacity is None:
            row_errors.append(RowError(row_number, "capacity", "invalid_capacity", row.get("capacity")))

        segment = existing_segments.get(segment_key) if segment_key else None
        if segment_key and segment is None:
            row_errors.append(RowError(row_number, "segment_key", "unknown_segment", row.get("segment_key")))

        if segment is not None and capacity is not None and capacity != segment.room_size:
            row_errors.append(
                RowError(
                    row_number,
                    "capacity",
                    "capacity_must_match_segment_room_size",
                    row.get("capacity"),
                )
            )

        if row_errors:
            result.errors.extend(e.as_dict() for e in row_errors)
            continue

        assert room_id is not None
        assert segment_key is not None
        assert capacity is not None
        assert segment is not None

        key = (segment_key, room_id)
        if key in seen_in_csv:
            result.errors.append(
                RowError(row_number, "room_id", "duplicate_room_id_in_file_for_segment", room_id).as_dict()
            )
            continue

        seen_in_csv.add(key)

        if key in existing_rooms:
            room = existing_rooms[key]
            changed = False
            if room.capacity != capacity:
                room.capacity = capacity
                changed = True
            
            if not room.is_active:
                room.is_active = True
                changed = True
                
            if changed:
                result.updated += 1
            else:
                result.unchanged += 1
        else:
            # Check for soft-deleted room
            inactive_row = db.execute(
                select(Room)
                .join(Segment, Room.segment_id == Segment.id)
                .where(Room.workspace_id == workspace_id, Segment.segment_key == segment_key, Room.room_id == room_id, Room.is_active == False)
            ).scalar_one_or_none()
            
            if inactive_row:
                inactive_row.capacity = capacity
                inactive_row.is_active = True
                result.updated += 1
            else:
                db.add(Room(
                    tenant_id=tenant_id,
                    workspace_id=workspace_id,
                    segment_id=segment.id,
                    room_id=room_id,
                    capacity=capacity,
                    source="uploaded", is_active=True,
                ))
                result.inserted += 1

    for key, room in existing_rooms.items():
        if key not in seen_in_csv:
            room.is_active = False
            result.soft_deleted += 1

    db.commit()
    return result


# DEPRECATED: Legacy insert-only ingestion.
# Phase 3+ uses plan_room_import() and apply_room_import().
# This function is retained for backward compatibility with existing tests
# and will be removed after all routes are migrated to the new flow.
def ingest_rooms_csv(db: Session, csv_path: str) -> dict[str, object]:
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    invalid_rows: list[dict[str, int | str | None]] = []
    accepted_rows = 0
    rejected_rows = 0
    duplicate_rows = 0

    existing_room_keys = {
        (seg_key, room.room_id)
        for room, seg_key in db.execute(select(Room, Segment.segment_key).join(Segment, Room.segment_id == Segment.id)).all()
    }
    seen_in_file: set[tuple[str, str]] = set()

    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise ValueError("CSV file is empty or missing header row")
        actual_columns = {name.strip() for name in reader.fieldnames}
        missing = sorted(REQUIRED_COLUMNS - actual_columns)
        if missing:
            raise ValueError(f"Missing required columns: {', '.join(missing)}")

        for row_number, row in enumerate(reader, start=2):
            room_id = safe_text(row.get("room_id"))
            segment_key = safe_text(row.get("segment_key"))
            capacity_raw = safe_text(row.get("capacity"))

            row_errors: list[RowError] = []

            if not room_id:
                row_errors.append(RowError(row_number, "room_id", "required", row.get("room_id")))

            if not segment_key:
                row_errors.append(RowError(row_number, "segment_key", "required", row.get("segment_key")))

            capacity = _parse_capacity(capacity_raw)
            if capacity is None:
                row_errors.append(RowError(row_number, "capacity", "invalid_capacity", row.get("capacity")))

            segment = db.scalar(select(Segment).where(Segment.segment_key == segment_key)) if segment_key else None
            if segment_key and segment is None:
                row_errors.append(RowError(row_number, "segment_key", "unknown_segment", row.get("segment_key")))

            if segment is not None and capacity is not None and capacity != segment.room_size:
                row_errors.append(
                    RowError(
                        row_number,
                        "capacity",
                        "capacity_must_match_segment_room_size",
                        row.get("capacity"),
                    )
                )

            if row_errors:
                rejected_rows += 1
                invalid_rows.extend(error.as_dict() for error in row_errors)
                continue
                
            assert room_id is not None
            assert segment_key is not None
            assert capacity is not None
            assert segment is not None

            key = (segment_key, room_id)
            if key in seen_in_file:
                duplicate_rows += 1
                rejected_rows += 1
                invalid_rows.append(
                    RowError(
                        row_number,
                        "room_id",
                        "duplicate_room_id_in_file_for_segment",
                        room_id,
                    ).as_dict()
                )
                continue

            if key in existing_room_keys:
                duplicate_rows += 1
                rejected_rows += 1
                invalid_rows.append(
                    RowError(
                        row_number,
                        "room_id",
                        "room_id_already_exists_for_segment",
                        room_id,
                    ).as_dict()
                )
                continue

            seen_in_file.add(key)
            existing_room_keys.add(key)
            db.add(
                Room(
                    tenant_id=segment.tenant_id,
                    workspace_id=segment.workspace_id,
                    segment_id=segment.id,
                    room_id=room_id,
                    capacity=capacity,
                    source="uploaded", is_active=True,
                )
            )
            accepted_rows += 1

    db.commit()

    return {
        "total_rows": accepted_rows + rejected_rows,
        "accepted_rows": accepted_rows,
        "rejected_rows": rejected_rows,
        "duplicate_rows": duplicate_rows,
        "invalid_rows": invalid_rows,
    }
