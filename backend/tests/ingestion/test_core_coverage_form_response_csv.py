from __future__ import annotations

import csv
import uuid
from datetime import date
from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from app.models.segment import Segment
from app.models.student import Student
from app.services.ingestion.form_response import QUESTION_KEYS
from app.services.ingestion.form_response_csv import (
    safe_text,
    _validate_header,
    ingest_form_responses_csv,
)

FIELDNAMES = ["admission_number", "phone_last4", *QUESTION_KEYS]

BASE_ANSWERS = {
    "q1_raw": "Before 11 PM (early)",
    "q2_raw": "Very tidy - I like things clean and organized",
    "q3_raw": "Before 10 PM",
    "q4a_raw": "Mainly for sleeping/studying, not for hanging out",
    "q4b_raw": "Very uncomfortable",
    "q5a_raw": "Almost never",
    "q5b_raw": "Very uncomfortable",
    "q6_raw": "I need a 100% smoke-free room",
    "q7_raw": "I require an alcohol-free room",
    "q8_raw": "I am strict vegetarian and require a meat-free room",
    "q9_raw": "Budget-conscious - prefer to keep costs low",
    "q10_raw": "I prefer someone very similar to me",
}


def _seed_student(db_session: Session, admission_number: str, phone_last4: str) -> uuid.UUID:
    segment = Segment(
        tenant_id=uuid.uuid4(),
        workspace_id=uuid.uuid4(),
        segment_key="M_1st_year_AC_2",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
    )
    db_session.add(segment)
    db_session.flush()
    student = Student(
        tenant_id=segment.tenant_id,
        workspace_id=segment.workspace_id,
        admission_number=admission_number,
        full_name=f"Student {admission_number}",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
        dob=date(2005, 1, 1),
        segment_id=segment.id,
        phone_number=f"987654{phone_last4}",
        phone_last4=phone_last4,
        is_active=True,
    )
    db_session.add(segment)
    db_session.add(student)
    db_session.commit()
    return student.workspace_id


def _write_csv(tmp_path: Path, name: str, rows: list[dict[str, str]]) -> str:
    file_path = tmp_path / name
    with file_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)
    return str(file_path)


def test_validate_header_rejects_missing_header_row() -> None:
    with pytest.raises(ValueError, match="missing header row"):
        _validate_header(None)


def test_validate_header_rejects_missing_columns() -> None:
    with pytest.raises(ValueError, match="Missing required columns"):
        _validate_header(["admission_number", "phone_last4"])


def test_safe_text_handles_none_and_padding() -> None:
    assert safe_text(None) == ""
    assert safe_text("  x  ") == "x"


def test_ingest_rejects_missing_file(db_session: Session, tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="CSV file not found"):
        ingest_form_responses_csv(db_session, uuid.uuid4(), str(tmp_path / "missing.csv"))


def test_ingest_rejects_csv_without_required_columns(db_session: Session, tmp_path: Path) -> None:
    file_path = tmp_path / "bad_header.csv"
    file_path.write_text("admission_number\nADM1\n", encoding="utf-8")

    with pytest.raises(ValueError, match="Missing required columns"):
        ingest_form_responses_csv(db_session, uuid.uuid4(), str(file_path))


def test_ingest_reports_blank_admission_and_phone_as_required(
    db_session: Session,
    tmp_path: Path,
) -> None:
    workspace_id = _seed_student(db_session, "ADM-COV-1", "1234")
    csv_path = _write_csv(
        tmp_path,
        "blank_fields.csv",
        [
            {"admission_number": "", "phone_last4": "1234", **BASE_ANSWERS},
            {"admission_number": "ADM-COV-1", "phone_last4": "", **BASE_ANSWERS},
        ],
    )

    result = ingest_form_responses_csv(db_session, workspace_id, csv_path)

    assert result["total_rows"] == 2
    assert result["accepted_rows"] == 0
    assert result["rejected_rows"] == 2
    invalid_rows = result["invalid_rows"]
    fields = {(entry["field"], entry["reason"]) for entry in invalid_rows}
    assert ("admission_number", "required") in fields
    assert ("phone_last4", "required") in fields
    assert all(entry["reason"] == "required" for entry in invalid_rows)
