from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.models.form_response import FormResponse
from app.models.segment import Segment
from app.models.student import Student
from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.services.ingestion.student_csv import (
    _normalize_ac_type,
    _normalize_gender,
    _parse_dob,
    _parse_room_size,
    apply_student_import,
    plan_student_import,
)

HEADER = "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number,segment_override\n"


def _seed_workspace(db_session: Session) -> tuple[uuid.UUID, uuid.UUID]:
    tenant = Tenant(slug=f"tenant-{uuid.uuid4().hex[:8]}", display_name="Test")
    db_session.add(tenant)
    db_session.flush()
    workspace = Workspace(tenant_id=tenant.id, name="Test WS", status="draft", source="manual")
    db_session.add(workspace)
    db_session.flush()
    return tenant.id, workspace.id


def _seed_student(
    db_session: Session,
    tenant_id: uuid.UUID,
    workspace_id: uuid.UUID,
    *,
    admission_number: str = "ADM001",
    full_name: str = "Alice",
    dob: date = date(2005, 1, 15),
) -> Student:
    segment = Segment(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        segment_key="F_1st_year_AC_2",
        gender="F",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
    )
    db_session.add(segment)
    db_session.flush()
    student = Student(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        segment_id=segment.id,
        admission_number=admission_number,
        full_name=full_name,
        gender="F",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
        dob=dob,
        phone_number="9876543210",
        phone_last4="3210",
        is_active=True,
    )
    db_session.add(student)
    db_session.flush()
    return student


def _csv_bytes(content: str) -> bytes:
    return content.encode("utf-8")


def test_normalizers_reject_unknown_values() -> None:
    assert _normalize_gender("unknown") is None
    assert _normalize_gender(" female ") == "F"
    assert _normalize_ac_type("unknown") is None
    assert _normalize_ac_type("non-ac") == "NonAC"


def test_room_size_and_dob_parsers_reject_invalid_values() -> None:
    assert _parse_room_size("two") is None
    assert _parse_room_size("5") is None
    assert _parse_room_size("4") == 4
    assert _parse_dob("not-a-date") is None
    assert _parse_dob("2005-01-15") == date(2005, 1, 15)


def test_plan_import_reports_every_invalid_field(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    csv_content = (
        HEADER
        + ",,x,,x,two,not-a-date,12,SEG_OVERRIDE\n"
        + "ADM002,Bob,M,1st_year,AC,5,2005-03-22,9876543211,\n"
        + "ADM003,Cara,F,1st_year,AC,2,2005-03-22,9876543212,\n"
    )

    result = plan_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))

    reasons = [error["reason"] for error in result.validation_errors]
    assert reasons == [
        "required",
        "required",
        "required",
        "invalid_gender",
        "invalid_ac_type",
        "invalid_room_size",
        "invalid_dob_iso_format",
        "invalid_phone_number_min_4_digits",
        "segment_override_not_supported_yet",
        "invalid_room_size",
    ]
    assert result.total_csv_rows == 3
    assert result.valid_csv_rows == 1
    assert [row["admission_number"] for row in result.to_insert] == ["ADM003"]


def test_plan_import_reports_dob_change(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    _seed_student(db_session, tenant_id, workspace_id, dob=date(2005, 1, 15))

    result = plan_student_import(
        db_session,
        workspace_id,
        tenant_id,
        _csv_bytes(HEADER + "ADM001,Alice,F,1st_year,AC,2,2005-02-20,9876543210,\n"),
    )

    assert len(result.to_update) == 1
    assert result.to_update[0]["changes"] == {
        "dob": {"old": "2005-01-15", "new": "2005-02-20"},
    }


def test_plan_import_warns_when_updated_student_has_form_response(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    student = _seed_student(db_session, tenant_id, workspace_id, full_name="Old Name")
    db_session.add(
        FormResponse(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            student_id=student.id,
            submitted_admission_number="ADM001",
            submitted_phone_last4="3210",
            submitted_at=datetime(2026, 3, 30, 12, 0, tzinfo=timezone.utc),
            validation_status="valid",
        )
    )
    db_session.flush()

    result = plan_student_import(
        db_session,
        workspace_id,
        tenant_id,
        _csv_bytes(HEADER + "ADM001,New Name,F,1st_year,AC,2,2005-01-15,9876543210,\n"),
    )

    assert len(result.to_update) == 1
    assert result.to_update[0]["warnings"] == ["has 1 form response(s)"]


def test_apply_import_reports_duplicate_admission_number_in_file(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    csv_content = (
        HEADER
        + "ADM100,Alice,F,1st_year,AC,2,2005-01-15,9876543210,\n"
        + "ADM100,Alice,F,1st_year,AC,2,2005-01-15,9876543210,\n"
    )

    result = apply_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))

    assert result.inserted == 1
    assert [error["reason"] for error in result.errors] == ["duplicate_admission_number_in_file"]
