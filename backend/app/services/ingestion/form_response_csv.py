from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from sqlalchemy.orm import Session

from app.services.ingestion.form_response import (
    QUESTION_KEYS,
    FormIntakeError,
    ingest_form_response,
)


REQUIRED_COLUMNS = {"admission_number", "dob", *QUESTION_KEYS}


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


def _parse_dob(value: str) -> date | None:
    text_value = value.strip()
    try:
        return date.fromisoformat(text_value)
    except ValueError:
        return None


def ingest_form_responses_csv(db: Session, csv_path: str) -> dict[str, object]:
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    invalid_rows: list[dict[str, int | str | None]] = []
    accepted_rows = 0
    rejected_rows = 0
    duplicate_rows = 0
    seen_in_file: set[str] = set()

    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        _validate_header(reader.fieldnames)

        for row_number, row in enumerate(reader, start=2):
            row_errors: list[RowError] = []

            admission_number = _safe_text(row.get("admission_number"))
            if not admission_number:
                row_errors.append(
                    RowError(
                        row_number,
                        "admission_number",
                        "required",
                        row.get("admission_number"),
                    )
                )

            dob_raw = _safe_text(row.get("dob"))
            dob = _parse_dob(dob_raw)
            if dob is None:
                row_errors.append(
                    RowError(
                        row_number,
                        "dob",
                        "invalid_dob_iso_format",
                        row.get("dob"),
                    )
                )

            if admission_number and admission_number in seen_in_file:
                duplicate_rows += 1
                row_errors.append(
                    RowError(
                        row_number,
                        "admission_number",
                        "duplicate_admission_number_in_file",
                        admission_number,
                    )
                )

            answers = {
                key: (_safe_text(row.get(key)) or None)
                for key in QUESTION_KEYS
            }

            if row_errors:
                rejected_rows += 1
                invalid_rows.extend(error.as_dict() for error in row_errors)
                continue

            seen_in_file.add(admission_number)
            assert dob is not None

            try:
                ingest_form_response(
                    db=db,
                    admission_number=admission_number,
                    dob=dob,
                    raw_answers=answers,
                )
            except FormIntakeError as exc:
                rejected_rows += 1
                invalid_rows.append(
                    RowError(
                        row_number,
                        "form_submission",
                        exc.code,
                        None,
                    ).as_dict()
                )
                continue

            accepted_rows += 1

    return {
        "total_rows": accepted_rows + rejected_rows,
        "accepted_rows": accepted_rows,
        "rejected_rows": rejected_rows,
        "duplicate_rows": duplicate_rows,
        "invalid_rows": invalid_rows,
    }
