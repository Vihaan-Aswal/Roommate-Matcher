from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.room import Room
from app.models.segment import Segment


REQUIRED_COLUMNS = {"room_id", "segment_key", "capacity"}


@dataclass
class RowError:
    row_number: int
    field: str
    reason: str
    raw_value: str | None

    def as_dict(self) -> dict[str, int | str | None]:
        return {
            "row_number": self.row_number,
            "field": self.field,
            "reason": self.reason,
            "raw_value": self.raw_value,
        }


def _validate_header(fieldnames: list[str] | None) -> None:
    if fieldnames is None:
        raise ValueError("CSV file is empty or missing header row")

    actual_columns = {name.strip() for name in fieldnames}
    missing = sorted(REQUIRED_COLUMNS - actual_columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")


def _safe_text(value: str | None) -> str:
    if value is None:
        return ""
    return value.strip()


def _parse_capacity(value: str) -> int | None:
    text_value = value.strip()
    if not text_value.isdigit():
        return None

    capacity = int(text_value)
    if capacity not in {2, 3, 4}:
        return None

    return capacity


def ingest_rooms_csv(db: Session, csv_path: str) -> dict[str, object]:
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    invalid_rows: list[dict[str, int | str | None]] = []
    accepted_rows = 0
    rejected_rows = 0
    duplicate_rows = 0

    existing_room_keys = {
        (segment_key, room_id)
        for segment_key, room_id in db.execute(select(Room.segment_key, Room.room_id)).all()
    }
    seen_in_file: set[tuple[str, str]] = set()

    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        _validate_header(reader.fieldnames)

        for row_number, row in enumerate(reader, start=2):
            room_id = _safe_text(row.get("room_id"))
            segment_key = _safe_text(row.get("segment_key"))
            capacity_raw = _safe_text(row.get("capacity"))

            row_errors: list[RowError] = []

            if not room_id:
                row_errors.append(RowError(row_number, "room_id", "required", row.get("room_id")))

            if not segment_key:
                row_errors.append(RowError(row_number, "segment_key", "required", row.get("segment_key")))

            capacity = _parse_capacity(capacity_raw)
            if capacity is None:
                row_errors.append(RowError(row_number, "capacity", "invalid_capacity", row.get("capacity")))

            segment = db.get(Segment, segment_key) if segment_key else None
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
                    room_id=room_id,
                    segment_key=segment_key,
                    capacity=capacity,
                    source="uploaded",
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
