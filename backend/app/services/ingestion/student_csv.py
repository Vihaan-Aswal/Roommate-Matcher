from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.segment import Segment
from app.models.student import Student


REQUIRED_COLUMNS = {
    "admission_number",
    "full_name",
    "gender",
    "year_group",
    "ac_type",
    "room_size",
    "dob",
}
OPTIONAL_COLUMNS = {"segment_override"}


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


def derive_segment_key(gender: str, year_group: str, ac_type: str, room_size: int) -> str:
    return f"{gender}_{year_group}_{ac_type}_{room_size}"


def _normalize_gender(value: str) -> str | None:
    normalized = value.strip().upper()
    if normalized in {"M", "MALE"}:
        return "M"
    if normalized in {"F", "FEMALE"}:
        return "F"
    return None


def _normalize_ac_type(value: str) -> str | None:
    normalized = value.strip().upper().replace("-", "")
    if normalized == "AC":
        return "AC"
    if normalized == "NONAC":
        return "NonAC"
    return None


def _parse_room_size(value: str) -> int | None:
    text_value = value.strip()
    if not text_value.isdigit():
        return None

    room_size = int(text_value)
    if room_size not in {2, 3, 4}:
        return None

    return room_size


def _parse_dob(value: str) -> date | None:
    text_value = value.strip()
    try:
        return date.fromisoformat(text_value)
    except ValueError:
        return None


def _parse_segment_override(value: str) -> tuple[str, str, str, int] | None:
    parts = [part.strip() for part in value.split("_") if part.strip()]
    if len(parts) < 4:
        return None

    gender_raw = parts[0]
    ac_type_raw = parts[-2]
    room_size_raw = parts[-1]
    year_group = "_".join(parts[1:-2])
    if not year_group:
        return None

    gender = _normalize_gender(gender_raw)
    ac_type = _normalize_ac_type(ac_type_raw)
    room_size = _parse_room_size(room_size_raw)
    if not gender or not ac_type or room_size is None:
        return None

    return (gender, year_group, ac_type, room_size)


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


def _build_row_payload(row: dict[str, str | None], row_number: int) -> tuple[dict[str, object] | None, list[RowError]]:
    errors: list[RowError] = []

    admission_number = _safe_text(row.get("admission_number"))
    if not admission_number:
        errors.append(RowError(row_number, "admission_number", "required", row.get("admission_number")))

    full_name = _safe_text(row.get("full_name"))
    if not full_name:
        errors.append(RowError(row_number, "full_name", "required", row.get("full_name")))

    year_group = _safe_text(row.get("year_group"))
    if not year_group:
        errors.append(RowError(row_number, "year_group", "required", row.get("year_group")))

    gender_raw = _safe_text(row.get("gender"))
    gender = _normalize_gender(gender_raw)
    if gender is None:
        errors.append(RowError(row_number, "gender", "invalid_gender", row.get("gender")))

    ac_type_raw = _safe_text(row.get("ac_type"))
    ac_type = _normalize_ac_type(ac_type_raw)
    if ac_type is None:
        errors.append(RowError(row_number, "ac_type", "invalid_ac_type", row.get("ac_type")))

    room_size_raw = _safe_text(row.get("room_size"))
    room_size = _parse_room_size(room_size_raw)
    if room_size is None:
        errors.append(RowError(row_number, "room_size", "invalid_room_size", row.get("room_size")))

    dob_raw = _safe_text(row.get("dob"))
    dob_value = _parse_dob(dob_raw)
    if dob_value is None:
        errors.append(RowError(row_number, "dob", "invalid_dob_iso_format", row.get("dob")))

    segment_override_raw = _safe_text(row.get("segment_override"))
    if segment_override_raw:
        parsed_override = _parse_segment_override(segment_override_raw)
        if parsed_override is None:
            errors.append(
                RowError(
                    row_number,
                    "segment_override",
                    "invalid_segment_override_format",
                    row.get("segment_override"),
                )
            )
        elif gender and ac_type and room_size is not None and year_group:
            override_gender, override_year_group, override_ac_type, override_room_size = parsed_override
            if (
                override_gender != gender
                or override_year_group != year_group
                or override_ac_type != ac_type
                or override_room_size != room_size
            ):
                errors.append(
                    RowError(
                        row_number,
                        "segment_override",
                        "segment_override_conflicts_with_row_dimensions",
                        row.get("segment_override"),
                    )
                )

    if errors:
        return None, errors

    assert gender is not None
    assert ac_type is not None
    assert room_size is not None
    assert dob_value is not None

    segment_key = segment_override_raw or derive_segment_key(gender, year_group, ac_type, room_size)
    return {
        "admission_number": admission_number,
        "full_name": full_name,
        "gender": gender,
        "year_group": year_group,
        "ac_type": ac_type,
        "room_size": room_size,
        "dob": dob_value,
        "segment_key": segment_key,
    }, []


def ingest_students_csv(db: Session, csv_path: str) -> dict[str, object]:
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    invalid_rows: list[dict[str, int | str | None]] = []
    accepted_rows = 0
    rejected_rows = 0
    duplicate_rows = 0

    existing_students = {
        admission_number
        for admission_number in db.scalars(select(Student.admission_number)).all()
    }
    existing_segments = {
        segment_key for segment_key in db.scalars(select(Segment.segment_key)).all()
    }
    seen_in_file: set[str] = set()

    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        _validate_header(reader.fieldnames)

        for row_number, row in enumerate(reader, start=2):
            row_payload, row_errors = _build_row_payload(row, row_number)
            if row_errors:
                rejected_rows += 1
                invalid_rows.extend(error.as_dict() for error in row_errors)
                continue

            assert row_payload is not None
            admission_number = row_payload["admission_number"]
            assert isinstance(admission_number, str)

            if admission_number in seen_in_file:
                duplicate_rows += 1
                rejected_rows += 1
                invalid_rows.append(
                    RowError(
                        row_number,
                        "admission_number",
                        "duplicate_admission_number_in_file",
                        admission_number,
                    ).as_dict()
                )
                continue

            if admission_number in existing_students:
                duplicate_rows += 1
                rejected_rows += 1
                invalid_rows.append(
                    RowError(
                        row_number,
                        "admission_number",
                        "admission_number_already_exists",
                        admission_number,
                    ).as_dict()
                )
                continue

            seen_in_file.add(admission_number)
            existing_students.add(admission_number)

            segment_key = row_payload["segment_key"]
            assert isinstance(segment_key, str)
            if segment_key not in existing_segments:
                db.add(
                    Segment(
                        segment_key=segment_key,
                        gender=row_payload["gender"],
                        year_group=row_payload["year_group"],
                        ac_type=row_payload["ac_type"],
                        room_size=row_payload["room_size"],
                    )
                )
                existing_segments.add(segment_key)

            db.add(
                Student(
                    admission_number=admission_number,
                    full_name=row_payload["full_name"],
                    gender=row_payload["gender"],
                    year_group=row_payload["year_group"],
                    ac_type=row_payload["ac_type"],
                    room_size=row_payload["room_size"],
                    dob=row_payload["dob"],
                    segment_key=segment_key,
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
