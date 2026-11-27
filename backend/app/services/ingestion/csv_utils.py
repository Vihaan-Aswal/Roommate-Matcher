"""Shared CSV parsing utilities for ingestion services."""
from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from typing import Any

from app.config import MAX_CSV_CELL_CHARS, MAX_CSV_ROWS, MAX_CSV_UPLOAD_BYTES

csv.field_size_limit(MAX_CSV_UPLOAD_BYTES)


class _CappedDictReader(csv.DictReader):
    """DictReader bounded by row count and cell size, with csv.Error normalised."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._data_rows = 0

    def __next__(self) -> dict[str | None, str | list[str] | None]:
        try:
            row = super().__next__()
        except csv.Error as exc:
            raise ValueError(f"CSV could not be parsed: {exc}") from exc
        self._data_rows += 1
        if self._data_rows > MAX_CSV_ROWS:
            raise ValueError(f"CSV has more than {MAX_CSV_ROWS} rows.")
        for key, value in row.items():
            if isinstance(value, str) and len(value) > MAX_CSV_CELL_CHARS:
                raise ValueError(
                    f"Row {self._data_rows}, column '{key}': "
                    f"value exceeds {MAX_CSV_CELL_CHARS} characters."
                )
        return row


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

    reader = _CappedDictReader(io.StringIO(text))
    if reader.fieldnames is not None:
        # Normalise in place so row lookups match the required-column check.
        reader.fieldnames = [name.strip() for name in reader.fieldnames]
        if len(set(reader.fieldnames)) != len(reader.fieldnames):
            raise ValueError("CSV header contains duplicate columns.")

    actual_columns = set(reader.fieldnames or [])
    missing = sorted(required_columns - actual_columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    return reader


def safe_text(value: str | None) -> str:
    if value is None:
        return ""
    return value.strip()
