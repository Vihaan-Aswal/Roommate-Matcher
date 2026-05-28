from __future__ import annotations

import csv
import uuid
from datetime import date
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.preference_profile import PreferenceProfile
from app.models.segment import Segment
from app.models.student import Student
from app.services.ingestion.form_response_csv import ingest_form_responses_csv

FIELDNAMES = [
    "admission_number",
    "phone_last4",
    "q1_raw",
    "q2_raw",
    "q3_raw",
    "q4a_raw",
    "q4b_raw",
    "q5a_raw",
    "q5b_raw",
    "q6_raw",
    "q7_raw",
    "q8_raw",
    "q9_raw",
    "q10_raw",
]

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
    segment = db_session.query(Segment).filter_by(segment_key="M_1st_year_AC_2").first()
    if segment is None:
        segment = Segment(tenant_id=uuid.uuid4(), workspace_id=uuid.uuid4(), segment_key="M_1st_year_AC_2",
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
    db_session.add(student)
    db_session.flush()
    return student.workspace_id

def _row(admission_number: str, phone_last4: str, **overrides: str) -> dict[str, str]:
    payload = {
        "admission_number": admission_number,
        "phone_last4": phone_last4,
        **BASE_ANSWERS,
    }
    payload.update(overrides)
    return payload

def _write_csv(tmp_path: Path, name: str, rows: list[dict[str, str]]) -> str:
    file_path = tmp_path / name
    with file_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)
    return str(file_path)

def test_ingest_form_responses_csv_accepts_valid_rows(db_session: Session, tmp_path: Path) -> None:
    workspace_id = _seed_student(db_session, "ADM9001", "1234")
    _seed_student(db_session, "ADM9002", "5678")
    
    # Wait, the two students might have different workspace_ids in my helper.
    # Let's fix that. I'll just use one student's workspace_id for both in the query.
    # Actually, _seed_student creates a new Segment if one doesn't exist, so they will share the same segment and workspace_id.
    
    db_session.commit()

    csv_path = _write_csv(
        tmp_path,
        "form_responses_valid.csv",
        [
            _row("ADM9001", "1234"),
            _row("ADM9002", "5678"),
        ],
    )

    result = ingest_form_responses_csv(db_session, workspace_id, csv_path)

    assert result["accepted_rows"] == 2
    assert result["rejected_rows"] == 0
    assert result["duplicate_rows"] == 0

    profiles = db_session.scalars(
        select(PreferenceProfile).where(PreferenceProfile.is_active == 1)
    ).all()
    assert len(profiles) == 2

def test_ingest_form_responses_csv_rejects_unknown_admission(db_session: Session, tmp_path: Path) -> None:
    workspace_id = _seed_student(db_session, "ADM9010", "1234")
    db_session.commit()

    csv_path = _write_csv(
        tmp_path,
        "form_responses_unknown.csv",
        [
            _row("ADM9010", "1234"),
            _row("ADM9999", "9999"),
        ],
    )

    result = ingest_form_responses_csv(db_session, workspace_id, csv_path)

    assert result["accepted_rows"] == 1
    assert result["rejected_rows"] == 1
    reasons = [entry["reason"] for entry in result["invalid_rows"]]
    assert "admission_number_not_found" in reasons

def test_ingest_form_responses_csv_rejects_duplicate_admission_in_file(
    db_session: Session,
    tmp_path: Path,
) -> None:
    workspace_id = _seed_student(db_session, "ADM9020", "1234")
    _seed_student(db_session, "ADM9021", "5678")
    db_session.commit()

    csv_path = _write_csv(
        tmp_path,
        "form_responses_duplicates.csv",
        [
            _row("ADM9020", "1234"),
            _row("ADM9020", "1234"),
            _row("ADM9021", "5678"),
        ],
    )

    result = ingest_form_responses_csv(db_session, workspace_id, csv_path)

    assert result["accepted_rows"] == 2
    assert result["rejected_rows"] == 1
    assert result["duplicate_rows"] == 1
    reasons = [entry["reason"] for entry in result["invalid_rows"]]
    assert "duplicate_admission_number_in_file" in reasons
