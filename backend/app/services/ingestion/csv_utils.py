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
        # utf-8-sig accepts both plain UTF-8 and a UTF-8 BOM; the BOM must be
        # stripped or it glues itself to the first header name.
        text = csv_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("CSV file encoding not supported. Use UTF-8.") from exc

    if not text.strip():
        raise ValueError("CSV file is empty.")

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is not None:
        # Normalise in place so row lookups match the required-column check.
        reader.fieldnames = [name.strip() for name in reader.fieldnames]

    actual_columns = set(reader.fieldnames or [])
    missing = sorted(required_columns - actual_columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    return reader


def safe_text(value: str | None) -> str:
    if value is None:
        return ""
    return value.strip()
