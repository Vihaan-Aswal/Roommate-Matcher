from __future__ import annotations

import csv
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
    "dob",
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


def _seed_student(db_session: Session, admission_number: str, dob: date) -> None:
    segment = db_session.get(Segment, "M_1st_year_AC_2")
    if segment is None:
        db_session.add(
            Segment(
                segment_key="M_1st_year_AC_2",
                gender="M",
                year_group="1st_year",
                ac_type="AC",
                room_size=2,
            )
        )
        db_session.flush()

    db_session.add(
        Student(
            admission_number=admission_number,
            full_name=f"Student {admission_number}",
            gender="M",
            year_group="1st_year",
            ac_type="AC",
            room_size=2,
            dob=dob,
            segment_key="M_1st_year_AC_2",
        )
    )


def _row(admission_number: str, dob: date, **overrides: str) -> dict[str, str]:
    payload = {
        "admission_number": admission_number,
        "dob": dob.isoformat(),
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
    _seed_student(db_session, "ADM9001", date(2005, 1, 1))
    _seed_student(db_session, "ADM9002", date(2005, 1, 2))
    db_session.commit()

    csv_path = _write_csv(
        tmp_path,
        "form_responses_valid.csv",
        [
            _row("ADM9001", date(2005, 1, 1)),
            _row("ADM9002", date(2005, 1, 2)),
        ],
    )

    result = ingest_form_responses_csv(db_session, csv_path)

    assert result["accepted_rows"] == 2
    assert result["rejected_rows"] == 0
    assert result["duplicate_rows"] == 0

    profiles = db_session.scalars(
        select(PreferenceProfile).where(PreferenceProfile.is_active == 1)
    ).all()
    assert len(profiles) == 2


def test_ingest_form_responses_csv_rejects_unknown_admission(db_session: Session, tmp_path: Path) -> None:
    _seed_student(db_session, "ADM9010", date(2005, 2, 1))
    db_session.commit()

    csv_path = _write_csv(
        tmp_path,
        "form_responses_unknown.csv",
        [
            _row("ADM9010", date(2005, 2, 1)),
            _row("ADM9999", date(2005, 2, 2)),
        ],
    )

    result = ingest_form_responses_csv(db_session, csv_path)

    assert result["accepted_rows"] == 1
    assert result["rejected_rows"] == 1
    reasons = [entry["reason"] for entry in result["invalid_rows"]]
    assert "admission_number_not_found" in reasons


def test_ingest_form_responses_csv_rejects_duplicate_admission_in_file(
    db_session: Session,
    tmp_path: Path,
) -> None:
    _seed_student(db_session, "ADM9020", date(2005, 3, 1))
    _seed_student(db_session, "ADM9021", date(2005, 3, 2))
    db_session.commit()

    csv_path = _write_csv(
        tmp_path,
        "form_responses_duplicates.csv",
        [
            _row("ADM9020", date(2005, 3, 1)),
            _row("ADM9020", date(2005, 3, 1)),
            _row("ADM9021", date(2005, 3, 2)),
        ],
    )

    result = ingest_form_responses_csv(db_session, csv_path)

    assert result["accepted_rows"] == 2
    assert result["rejected_rows"] == 1
    assert result["duplicate_rows"] == 1
    reasons = [entry["reason"] for entry in result["invalid_rows"]]
    assert "duplicate_admission_number_in_file" in reasons
