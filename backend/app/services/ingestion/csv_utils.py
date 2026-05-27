"""Shared CSV parsing utilities for ingestion services."""
from __future__ import annotations

import csv
import io
from dataclasses import dataclass


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


def parse_csv_bytes(csv_bytes: bytes, required_columns: set[str]) -> csv.DictReader:
    """Decode CSV bytes, validate header, return DictReader."""
    try:
        text = csv_bytes.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = csv_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise ValueError("CSV file encoding not supported. Use UTF-8.")

    if not text.strip():
        raise ValueError("CSV file is empty.")

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise ValueError("CSV file is empty or missing header row")

    actual_columns = {name.strip() for name in reader.fieldnames}
    missing = sorted(required_columns - actual_columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    return reader


def safe_text(value: str | None) -> str:
    if value is None:
        return ""
    return value.strip()
