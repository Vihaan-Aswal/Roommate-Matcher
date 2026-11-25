from __future__ import annotations

import csv
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.form_response import FormResponse
from app.models.preference_profile import PreferenceProfile
from app.models.segment import Segment
from app.models.student import Student
from app.services.ingestion.form_response_csv import (
    ingest_form_responses_csv,
    ingest_form_responses_csv_bulk,
)
from app.services.ingestion.form_response import (
    BulkFormSubmission,
    ingest_form_responses_bulk,
)

from tests.ingestion.test_form_response_csv import (
    BASE_ANSWERS,
    FIELDNAMES,
    _row,
    _write_csv,
)

TENANT_ID = uuid.uuid4()


def _seed_workspace(db_session: Session, admissions: list[str]) -> uuid.UUID:
    workspace_id = uuid.uuid4()
    segment = Segment(
        tenant_id=TENANT_ID,
        workspace_id=workspace_id,
        segment_key="M_1st_year_AC_2",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
    )
    db_session.add(segment)
    db_session.flush()

    for admission_number in admissions:
        db_session.add(
            Student(
                tenant_id=TENANT_ID,
                workspace_id=workspace_id,
                segment_id=segment.id,
                admission_number=admission_number,
                full_name=f"Student {admission_number}",
                gender="M",
                year_group="1st_year",
                ac_type="AC",
                room_size=2,
                dob=date(2005, 1, 1),
                phone_number="9876543210",
                phone_last4="1234",
                is_active=True,
            )
        )
    db_session.commit()
    return workspace_id


def _count(db_session: Session, model, *conditions) -> int:
    return db_session.scalar(select(func.count()).select_from(model).where(*conditions)) or 0


def test_bulk_matches_per_row_for_valid_rows(db_session: Session, tmp_path: Path) -> None:
    csv_path = _write_csv(
        tmp_path,
        "valid.csv",
        [_row("ADM7001", "1234"), _row("ADM7002", "1234"), _row("ADM7003", "1234")],
    )

    per_row_workspace = _seed_workspace(db_session, ["ADM7001", "ADM7002", "ADM7003"])
    per_row = ingest_form_responses_csv(db_session, per_row_workspace, csv_path)

    bulk_workspace = _seed_workspace(db_session, ["ADM7001", "ADM7002", "ADM7003"])
    bulk = ingest_form_responses_csv_bulk(db_session, bulk_workspace, csv_path)

    assert bulk == per_row
    assert bulk["accepted_rows"] == 3
    assert bulk["rejected_rows"] == 0

    for workspace_id in (per_row_workspace, bulk_workspace):
        assert _count(
            db_session, FormResponse, FormResponse.workspace_id == workspace_id
        ) == 3
        assert _count(
            db_session,
            PreferenceProfile,
            PreferenceProfile.workspace_id == workspace_id,
            PreferenceProfile.is_active == True,
        ) == 3
        profile = db_session.scalars(
            select(PreferenceProfile).where(PreferenceProfile.workspace_id == workspace_id)
        ).first()
        assert profile is not None
        assert profile.has_preferences is True
        assert profile.q1_raw == BASE_ANSWERS["q1_raw"]
        assert profile.q1_enc == 1.0


def test_bulk_records_invalid_rows_like_the_per_row_path(
    db_session: Session,
    tmp_path: Path,
) -> None:
    csv_path = _write_csv(
        tmp_path,
        "mixed.csv",
        [
            _row("ADM7101", "1234"),
            _row("ADM7102", "9999"),  # phone mismatch
            _row("ADM7103", "1234", q1_raw="not an option"),  # invalid option
            _row("ADM7104", "1234", q1_raw=""),  # incomplete answers
            _row("ADM7105", ""),  # missing phone
            _row("ADM9999", "1234"),  # unknown admission
            _row("ADM7101", "1234"),  # duplicate admission
        ],
    )
    admissions = ["ADM7101", "ADM7102", "ADM7103", "ADM7104", "ADM7105"]

    per_row_workspace = _seed_workspace(db_session, admissions)
    per_row = ingest_form_responses_csv(db_session, per_row_workspace, csv_path)

    bulk_workspace = _seed_workspace(db_session, admissions)
    bulk = ingest_form_responses_csv_bulk(db_session, bulk_workspace, csv_path)

    assert bulk["accepted_rows"] == per_row["accepted_rows"] == 1
    assert bulk["rejected_rows"] == per_row["rejected_rows"] == 6
    assert bulk["duplicate_rows"] == per_row["duplicate_rows"] == 1
    assert sorted(entry["reason"] for entry in bulk["invalid_rows"]) == sorted(
        entry["reason"] for entry in per_row["invalid_rows"]
    )

    # Invalid submissions that reached the domain layer are still recorded;
    # CSV-level rejections (missing phone, unknown admission, duplicate) are not.
    assert _count(
        db_session,
        FormResponse,
        FormResponse.workspace_id == bulk_workspace,
        FormResponse.validation_status == "invalid",
    ) == 3
    assert _count(
        db_session,
        PreferenceProfile,
        PreferenceProfile.workspace_id == bulk_workspace,
    ) == 1


def test_bulk_replaces_the_active_profile_on_reimport(
    db_session: Session,
    tmp_path: Path,
) -> None:
    workspace_id = _seed_workspace(db_session, ["ADM7201"])
    csv_path = _write_csv(tmp_path, "first.csv", [_row("ADM7201", "1234")])
    second_path = _write_csv(
        tmp_path,
        "second.csv",
        [_row("ADM7201", "1234", q1_raw="After 3 AM (very late)")],
    )

    first = ingest_form_responses_csv_bulk(db_session, workspace_id, csv_path)
    second = ingest_form_responses_csv_bulk(db_session, workspace_id, second_path)

    assert first["accepted_rows"] == 1
    assert second["accepted_rows"] == 1

    profiles = db_session.scalars(
        select(PreferenceProfile)
        .where(PreferenceProfile.workspace_id == workspace_id)
        .order_by(PreferenceProfile.q1_enc)
    ).all()
    assert [profile.is_active for profile in profiles] == [False, True]
    assert profiles[-1].q1_enc == 4.0

    assert _count(
        db_session,
        PreferenceProfile,
        PreferenceProfile.workspace_id == workspace_id,
        PreferenceProfile.is_active == True,
    ) == 1


def test_bulk_empty_csv_changes_nothing(db_session: Session, tmp_path: Path) -> None:
    workspace_id = _seed_workspace(db_session, ["ADM7301"])
    empty_path = tmp_path / "empty.csv"
    empty_path.write_text(",".join(FIELDNAMES) + "\n", encoding="utf-8")

    result = ingest_form_responses_csv_bulk(db_session, workspace_id, str(empty_path))

    assert result["accepted_rows"] == 0
    assert result["rejected_rows"] == 0
    assert _count(db_session, FormResponse) == 0


def test_bulk_missing_file_raises(db_session: Session, tmp_path: Path) -> None:
    workspace_id = _seed_workspace(db_session, ["ADM7401"])

    try:
        ingest_form_responses_csv_bulk(db_session, workspace_id, str(tmp_path / "missing.csv"))
    except FileNotFoundError as exc:
        assert "missing.csv" in str(exc)
    else:
        raise AssertionError("expected FileNotFoundError")


def test_bulk_all_unknown_admissions_writes_nothing(
    db_session: Session,
    tmp_path: Path,
) -> None:
    workspace_id = _seed_workspace(db_session, ["ADM7501"])
    csv_path = _write_csv(tmp_path, "unknown.csv", [_row("ADM9999", "1234")])

    result = ingest_form_responses_csv_bulk(db_session, workspace_id, csv_path)

    assert result["accepted_rows"] == 0
    assert result["rejected_rows"] == 1
    assert [entry["reason"] for entry in result["invalid_rows"]] == [
        "admission_number_not_found"
    ]
    assert _count(db_session, FormResponse) == 0
    assert _count(db_session, PreferenceProfile) == 0


def test_bulk_does_not_replace_an_active_profile_that_is_newer(
    db_session: Session,
    tmp_path: Path,
) -> None:
    workspace_id = _seed_workspace(db_session, ["ADM7601"])
    student = db_session.scalars(
        select(Student).where(Student.workspace_id == workspace_id)
    ).one()

    future_response = FormResponse(
        tenant_id=TENANT_ID,
        workspace_id=workspace_id,
        student_id=student.id,
        submitted_admission_number=student.admission_number,
        submitted_phone_last4=student.phone_last4,
        submitted_at=datetime.now(tz=timezone.utc) + timedelta(days=1),
        validation_status="valid",
        invalid_reason=None,
    )
    db_session.add(future_response)
    db_session.flush()
    db_session.add(
        PreferenceProfile(
            tenant_id=TENANT_ID,
            workspace_id=workspace_id,
            student_id=student.id,
            source_form_response_id=future_response.id,
            has_preferences=True,
            is_active=True,
            is_generated=False,
        )
    )
    db_session.commit()

    csv_path = _write_csv(tmp_path, "older.csv", [_row("ADM7601", "1234")])
    result = ingest_form_responses_csv_bulk(db_session, workspace_id, csv_path)

    assert result["accepted_rows"] == 1
    profiles = db_session.scalars(
        select(PreferenceProfile)
        .where(PreferenceProfile.workspace_id == workspace_id)
        .order_by(PreferenceProfile.is_active)
    ).all()
    assert [profile.is_active for profile in profiles] == [False, True]
    assert profiles[-1].id == db_session.scalars(
        select(PreferenceProfile.id).where(
            PreferenceProfile.source_form_response_id == future_response.id
        )
    ).one()


def test_bulk_repeated_submissions_keep_only_the_last_profile_active(
    db_session: Session,
) -> None:
    workspace_id = _seed_workspace(db_session, ["ADM7701"])
    older = dict(BASE_ANSWERS)
    newer = {**BASE_ANSWERS, "q1_raw": "After 3 AM (very late)"}

    codes = ingest_form_responses_bulk(
        db_session,
        workspace_id,
        [
            BulkFormSubmission("ADM7701", "1234", older),
            BulkFormSubmission("ADM7701", "1234", newer),
        ],
    )

    assert codes == [None, None]
    assert _count(db_session, FormResponse) == 2
    profiles = db_session.scalars(
        select(PreferenceProfile)
        .where(PreferenceProfile.workspace_id == workspace_id)
        .order_by(PreferenceProfile.q1_enc)
    ).all()
    assert [profile.is_active for profile in profiles] == [False, True]
    assert profiles[-1].q1_enc == 4.0
