from __future__ import annotations

import csv
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

from sqlalchemy.orm import Session

from app.services.ingestion.csv_utils import RowError, safe_text
from app.services.ingestion.form_response import (
    QUESTION_KEYS,
    BulkFormSubmission,
    FormIntakeError,
    ingest_form_response,
    ingest_form_responses_bulk,
)


REQUIRED_COLUMNS = {"admission_number", "phone_last4", *QUESTION_KEYS}


def _validate_header(fieldnames: list[str] | None) -> None:
    if fieldnames is None:
        raise ValueError("CSV file is empty or missing header row")

    # Mutate in place: DictReader.fieldnames is the reader's own list.
    fieldnames[:] = [name.strip() for name in fieldnames]
    missing = sorted(REQUIRED_COLUMNS - set(fieldnames))
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")


@dataclass
class _CsvRow:
    row_number: int
    admission_number: str | None
    phone_last4: str | None
    answers: dict[str, str | None]
    errors: list[RowError]
    is_duplicate: bool


def _iter_rows(csv_path: str) -> Iterator[_CsvRow]:
    seen_in_file: set[str] = set()

    with Path(csv_path).open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        _validate_header(reader.fieldnames)

        for row_number, row in enumerate(reader, start=2):
            row_errors: list[RowError] = []

            admission_number = safe_text(row.get("admission_number"))
            if not admission_number:
                row_errors.append(
                    RowError(
                        row_number,
                        "admission_number",
                        "required",
                        row.get("admission_number"),
                    )
                )

            phone_last4 = safe_text(row.get("phone_last4"))
            if not phone_last4:
                row_errors.append(
                    RowError(
                        row_number,
                        "phone_last4",
                        "required",
                        row.get("phone_last4"),
                    )
                )

            is_duplicate = bool(admission_number and admission_number in seen_in_file)
            if is_duplicate:
                row_errors.append(
                    RowError(
                        row_number,
                        "admission_number",
                        "duplicate_admission_number_in_file",
                        admission_number,
                    )
                )

            answers = {
                key: (safe_text(row.get(key)) or None)
                for key in QUESTION_KEYS
            }

            if not row_errors and admission_number:
                seen_in_file.add(admission_number)

            yield _CsvRow(
                row_number=row_number,
                admission_number=admission_number,
                phone_last4=phone_last4,
                answers=answers,
                errors=row_errors,
                is_duplicate=is_duplicate,
            )


def _result(
    accepted_rows: int,
    rejected_rows: int,
    duplicate_rows: int,
    invalid_rows: list[dict[str, int | str | None]],
) -> dict[str, object]:
    return {
        "total_rows": accepted_rows + rejected_rows,
        "accepted_rows": accepted_rows,
        "rejected_rows": rejected_rows,
        "duplicate_rows": duplicate_rows,
        "invalid_rows": invalid_rows,
    }


def ingest_form_responses_csv(db: Session, workspace_id: uuid.UUID, csv_path: str) -> dict[str, object]:
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    invalid_rows: list[dict[str, int | str | None]] = []
    accepted_rows = 0
    rejected_rows = 0
    duplicate_rows = 0

    for parsed in _iter_rows(csv_path):
        if parsed.is_duplicate:
            duplicate_rows += 1

        if parsed.errors:
            rejected_rows += 1
            invalid_rows.extend(error.as_dict() for error in parsed.errors)
            continue

        assert parsed.admission_number is not None
        assert parsed.phone_last4 is not None

        try:
            ingest_form_response(
                db=db,
                workspace_id=workspace_id,
                admission_number=parsed.admission_number,
                phone_last4=parsed.phone_last4,
                raw_answers=parsed.answers,
            )
        except FormIntakeError as exc:
            rejected_rows += 1
            invalid_rows.append(
                RowError(
                    parsed.row_number,
                    "form_submission",
                    exc.code,
                    None,
                ).as_dict()
            )
            continue

        accepted_rows += 1

    return _result(accepted_rows, rejected_rows, duplicate_rows, invalid_rows)


def ingest_form_responses_csv_bulk(
    db: Session,
    workspace_id: uuid.UUID,
    csv_path: str,
) -> dict[str, object]:
    """Same result shape as ingest_form_responses_csv, one transaction.

    Used by the demo seed only. Admin CSV uploads keep the per-row path so a
    single bad row cannot roll back the rows before it.
    """
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    invalid_rows: list[dict[str, int | str | None]] = []
    accepted_rows = 0
    rejected_rows = 0
    duplicate_rows = 0
    pending: list[tuple[_CsvRow, BulkFormSubmission]] = []

    for parsed in _iter_rows(csv_path):
        if parsed.is_duplicate:
            duplicate_rows += 1

        if parsed.errors:
            rejected_rows += 1
            invalid_rows.extend(error.as_dict() for error in parsed.errors)
            continue

        assert parsed.admission_number is not None
        assert parsed.phone_last4 is not None

        pending.append(
            (
                parsed,
                BulkFormSubmission(
                    admission_number=parsed.admission_number,
                    phone_last4=parsed.phone_last4,
                    raw_answers=parsed.answers,
                ),
            )
        )

    codes = ingest_form_responses_bulk(
        db,
        workspace_id,
        [submission for _parsed, submission in pending],
    )

    for (parsed, _submission), code in zip(pending, codes):
        if code is None:
            accepted_rows += 1
            continue

        rejected_rows += 1
        invalid_rows.append(
            RowError(
                parsed.row_number,
                "form_submission",
                code,
                None,
            ).as_dict()
        )

    return _result(accepted_rows, rejected_rows, duplicate_rows, invalid_rows)
