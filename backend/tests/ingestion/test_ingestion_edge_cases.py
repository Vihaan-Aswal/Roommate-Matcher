"""Edge cases for CSV ingestion: encoding, row validation, apply-side revival."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

import pytest
from sqlalchemy.orm import Session

from app.models.form_response import FormResponse
from app.models.room import Room
from app.models.segment import Segment
from app.models.student import Student
from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.services.ingestion.csv_utils import parse_csv_bytes
from app.services.ingestion.form_response import (
    FormIntakeError,
    _build_encoded_answers,
    _normalize_raw_answers,
    ingest_form_response,
)
from app.services.ingestion.form_response_csv import (
    _safe_text as form_safe_text,
    ingest_form_responses_csv,
)
from app.services.ingestion.room_csv import apply_room_import, plan_room_import
from app.services.ingestion.student_csv import apply_student_import, plan_student_import

STUDENT_HEADER = (
    "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n"
)
ROOM_HEADER = "room_id,segment_key,capacity\n"

ANSWERS = {
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


def _workspace(db_session: Session) -> tuple[uuid.UUID, uuid.UUID]:
    tenant = Tenant(slug=f"ing-{uuid.uuid4().hex[:8]}", display_name="Ingestion Tenant")
    db_session.add(tenant)
    db_session.flush()
    workspace = Workspace(tenant_id=tenant.id, name="Ingestion WS", status="draft")
    db_session.add(workspace)
    db_session.flush()
    return tenant.id, workspace.id


def _student(
    db_session: Session,
    tenant_id,
    workspace_id,
    *,
    admission_number: str = "EDG001",
    phone_last4: str = "3210",
    is_active: bool = True,
) -> Student:
    segment = db_session.query(Segment).filter_by(workspace_id=workspace_id).first()
    if segment is None:
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
        full_name="Edge Student",
        gender="F",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
        dob=date(2005, 1, 1),
        phone_number="9876543210",
        phone_last4=phone_last4,
        is_active=is_active,
    )
    db_session.add(student)
    db_session.commit()
    return student


# ---------------------------------------------------------------------------
# csv_utils
# ---------------------------------------------------------------------------


def test_parse_csv_bytes_supports_utf8_bom() -> None:
    # NOTE: a real UTF-8 BOM is *not* stripped today (reported defect); decode
    # falls back to utf-8-sig only when plain UTF-8 decoding fails.
    payload = "admission_number,full_name\nA1,Ann\n".encode("utf-8")
    reader = parse_csv_bytes(payload, {"admission_number", "full_name"})
    assert reader.fieldnames == ["admission_number", "full_name"]


def test_parse_csv_bytes_rejects_unsupported_encoding() -> None:
    with pytest.raises(ValueError, match="encoding not supported"):
        parse_csv_bytes(b"\xff\xfe\x00\x00\x9c", {"admission_number"})


def test_parse_csv_bytes_rejects_empty_and_incomplete_headers() -> None:
    with pytest.raises(ValueError, match="CSV file is empty."):
        parse_csv_bytes(b"   \n  ", {"admission_number"})
    with pytest.raises(ValueError, match="Missing required columns"):
        parse_csv_bytes(STUDENT_HEADER.encode("utf-8"), {"admission_number", "missing_column"})


def test_form_response_csv_safe_text_handles_none() -> None:
    assert form_safe_text(None) == ""
    assert form_safe_text("  padded  ") == "padded"


def test_shared_safe_text_handles_none() -> None:
    from app.services.ingestion.csv_utils import safe_text

    assert safe_text(None) == ""
    assert safe_text("  value  ") == "value"


# ---------------------------------------------------------------------------
# student_csv: per-field validation
# ---------------------------------------------------------------------------


def test_student_plan_flags_every_invalid_field(db_session: Session) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    csv_bytes = (
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number,"
        "segment_override\n"
        ",,X,,XYZ,9,not-a-date,12,manual\n"
    ).encode("utf-8")

    result = plan_student_import(db_session, workspace_id, tenant_id, csv_bytes)

    reasons = {error["field"]: error["reason"] for error in result.validation_errors}
    assert reasons["admission_number"] == "required"
    assert reasons["full_name"] == "required"
    assert reasons["gender"] == "invalid_gender"
    assert reasons["year_group"] == "required"
    assert reasons["ac_type"] == "invalid_ac_type"
    assert reasons["room_size"] == "invalid_room_size"
    assert reasons["dob"] == "invalid_dob_iso_format"
    assert reasons["phone_number"] == "invalid_phone_number_min_4_digits"
    assert reasons["segment_override"] == "segment_override_not_supported_yet"
    assert result.total_csv_rows == 1
    assert result.valid_csv_rows == 0


def test_student_plan_rejects_duplicate_admission_numbers(db_session: Session) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    row = "DUP001,Ann,F,1st_year,AC,2,2005-01-01,9876543210\n"

    result = plan_student_import(
        db_session, workspace_id, tenant_id, (STUDENT_HEADER + row * 2).encode("utf-8")
    )

    assert result.valid_csv_rows == 1
    assert result.validation_errors[0]["reason"] == "duplicate_admission_number_in_file"


def test_student_plan_reports_dob_change_and_form_response_warning(
    db_session: Session,
) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    student = _student(db_session, tenant_id, workspace_id, admission_number="CHG001")
    db_session.add(
        FormResponse(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            student_id=student.id,
            submitted_admission_number="CHG001",
            submitted_phone_last4="3210",
            submitted_at=datetime.now(timezone.utc),
            validation_status="valid",
        )
    )
    db_session.commit()

    csv_bytes = (
        STUDENT_HEADER + "CHG001,Ann,F,1st_year,AC,2,2006-02-02,9876543210\n"
    ).encode("utf-8")
    result = plan_student_import(db_session, workspace_id, tenant_id, csv_bytes)

    assert len(result.to_update) == 1
    assert result.to_update[0]["changes"]["dob"] == {"old": "2005-01-01", "new": "2006-02-02"}
    assert result.to_update[0]["warnings"] == ["has 1 form response(s)"]


def test_student_apply_rejects_duplicate_rows(db_session: Session) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    row = "APD001,Ann,F,1st_year,AC,2,2005-01-01,9876543210\n"

    result = apply_student_import(
        db_session, workspace_id, tenant_id, (STUDENT_HEADER + row * 2).encode("utf-8")
    )

    assert result.inserted == 1
    assert result.errors[0]["reason"] == "duplicate_admission_number_in_file"


def test_student_apply_reactivates_a_soft_deleted_row(db_session: Session) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    _student(
        db_session, tenant_id, workspace_id, admission_number="REV001", is_active=False
    )

    result = apply_student_import(
        db_session,
        workspace_id,
        tenant_id,
        (
            STUDENT_HEADER + "REV001,Ann,F,1st_year,AC,2,2005-01-01,9876543210\n"
        ).encode("utf-8"),
    )

    assert result.inserted == 0
    assert result.updated == 1
    revived = db_session.query(Student).filter_by(admission_number="REV001").one()
    assert revived.is_active is True


def test_student_apply_rejects_unparseable_csv(db_session: Session) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    with pytest.raises(ValueError, match="Missing required columns"):
        apply_student_import(db_session, workspace_id, tenant_id, b"bad\nheader\n")


def test_student_apply_reports_unchanged_rows_and_soft_deletes_missing_ones(
    db_session: Session,
) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    _student(db_session, tenant_id, workspace_id, admission_number="UNCH001")
    _student(db_session, tenant_id, workspace_id, admission_number="GONE001")

    result = apply_student_import(
        db_session,
        workspace_id,
        tenant_id,
        (
            STUDENT_HEADER
            + "UNCH001,Edge Student,F,1st_year,AC,2,2005-01-01,9876543210\n"
        ).encode("utf-8"),
    )

    assert result.unchanged == 1
    assert result.soft_deleted == 1
    gone = db_session.query(Student).filter_by(admission_number="GONE001").one()
    assert gone.is_active is False


def test_student_apply_rejects_a_header_only_file_without_touching_the_roster(
    db_session: Session,
) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    student = _student(db_session, tenant_id, workspace_id, admission_number="KEEP001")

    with pytest.raises(ValueError, match="no valid rows"):
        apply_student_import(db_session, workspace_id, tenant_id, STUDENT_HEADER.encode("utf-8"))

    db_session.refresh(student)
    assert student.is_active is True
    assert db_session.query(Segment).filter_by(workspace_id=workspace_id).count() == 1


def test_student_apply_rejects_an_all_invalid_file_without_touching_the_roster(
    db_session: Session,
) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    student = _student(db_session, tenant_id, workspace_id, admission_number="KEEP002")
    csv_bytes = (
        STUDENT_HEADER + "BAD001,Ann,F,1st_year,AC,2,01/02/2005,9876543210\n"
    ).encode("utf-8")

    with pytest.raises(ValueError, match="no valid rows"):
        apply_student_import(db_session, workspace_id, tenant_id, csv_bytes)

    db_session.refresh(student)
    assert student.is_active is True
    assert db_session.query(Segment).filter_by(workspace_id=workspace_id).count() == 1


def test_student_apply_still_updates_inserts_and_soft_deletes_for_a_valid_file(
    db_session: Session,
) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    _student(db_session, tenant_id, workspace_id, admission_number="UPD001")
    _student(db_session, tenant_id, workspace_id, admission_number="GONE002")

    result = apply_student_import(
        db_session,
        workspace_id,
        tenant_id,
        (
            STUDENT_HEADER
            + "UPD001,Edge Student,F,1st_year,AC,2,2006-02-02,9876543210\n"
            + "NEW001,New Student,F,1st_year,AC,2,2005-01-01,9876543210\n"
        ).encode("utf-8"),
    )

    assert (result.inserted, result.updated, result.soft_deleted) == (1, 1, 1)
    gone = db_session.query(Student).filter_by(admission_number="GONE002").one()
    assert gone.is_active is False


def test_student_apply_requires_confirmation_for_a_mass_removal(
    db_session: Session,
) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    for index in range(12):
        _student(db_session, tenant_id, workspace_id, admission_number=f"MASS{index:03d}")

    csv_bytes = (
        STUDENT_HEADER + "MASS000,Edge Student,F,1st_year,AC,2,2005-01-01,9876543210\n"
    ).encode("utf-8")

    plan = plan_student_import(db_session, workspace_id, tenant_id, csv_bytes)
    assert plan.requires_removal_confirmation is True

    with pytest.raises(ValueError, match="confirm_removals=true"):
        apply_student_import(db_session, workspace_id, tenant_id, csv_bytes)

    assert (
        db_session.query(Student)
        .filter_by(workspace_id=workspace_id, is_active=True)
        .count()
        == 12
    )

    result = apply_student_import(
        db_session, workspace_id, tenant_id, csv_bytes, confirm_removals=True
    )

    assert result.soft_deleted == 11
    assert (
        db_session.query(Student)
        .filter_by(workspace_id=workspace_id, is_active=True)
        .count()
        == 1
    )


def test_student_apply_one_removal_needs_no_confirmation(db_session: Session) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    for index in range(6):
        _student(db_session, tenant_id, workspace_id, admission_number=f"SMALL{index:03d}")

    rows = "".join(
        f"SMALL{index:03d},Edge Student,F,1st_year,AC,2,2005-01-01,9876543210\n"
        for index in range(5)
    )
    csv_bytes = (STUDENT_HEADER + rows).encode("utf-8")

    plan = plan_student_import(db_session, workspace_id, tenant_id, csv_bytes)
    assert plan.requires_removal_confirmation is False

    result = apply_student_import(db_session, workspace_id, tenant_id, csv_bytes)
    assert result.soft_deleted == 1


def test_student_preview_and_apply_agree_on_a_mixed_file(db_session: Session) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    _student(db_session, tenant_id, workspace_id, admission_number="MIX001")

    csv_bytes = (
        STUDENT_HEADER
        + "MIX001,Edge Student,F,1st_year,AC,2,2005-01-01,9876543210\n"
        + "MIX002,New One,F,1st_year,AC,2,2005-01-01,9876543210\n"
        + "BROKEN,Ann,F,1st_year,AC,2,01/02/2005,9876543210\n"
        + "MIX002,New One Again,F,1st_year,AC,2,2005-01-01,9876543210\n"
    ).encode("utf-8")

    plan = plan_student_import(db_session, workspace_id, tenant_id, csv_bytes)
    assert plan.valid_csv_rows == 2
    assert {error["reason"] for error in plan.validation_errors} == {
        "invalid_dob_iso_format",
        "duplicate_admission_number_in_file",
    }
    expected_admissions = (
        {row["admission_number"] for row in plan.to_insert}
        | {row["admission_number"] for row in plan.to_update}
        | set(plan.unchanged)
    )
    assert expected_admissions == {"MIX001", "MIX002"}

    applied = apply_student_import(db_session, workspace_id, tenant_id, csv_bytes)

    assert applied.errors == plan.validation_errors
    assert (applied.inserted, applied.updated, applied.soft_deleted) == (
        len(plan.to_insert),
        len(plan.to_update),
        len(plan.to_soft_delete),
    )
    active = {
        student.admission_number
        for student in db_session.query(Student)
        .filter_by(workspace_id=workspace_id, is_active=True)
        .all()
    }
    assert active == expected_admissions


def test_student_plan_and_apply_accept_headers_with_a_space_after_the_comma(
    db_session: Session,
) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    csv_bytes = (
        "admission_number, full_name, gender, year_group, ac_type, room_size, dob, phone_number\n"
        "SPACE001, Ann, F, 1st_year, AC, 2, 2005-01-01, 9876543210\n"
    ).encode("utf-8")

    plan = plan_student_import(db_session, workspace_id, tenant_id, csv_bytes)
    assert plan.valid_csv_rows == 1
    assert [row["admission_number"] for row in plan.to_insert] == ["SPACE001"]

    result = apply_student_import(db_session, workspace_id, tenant_id, csv_bytes)
    assert result.inserted == 1
    stored = db_session.query(Student).filter_by(admission_number="SPACE001").one()
    assert stored.full_name == "Ann"


# ---------------------------------------------------------------------------
# room_csv: per-field validation and apply behaviour
# ---------------------------------------------------------------------------


def _room_segment(db_session: Session, tenant_id, workspace_id) -> Segment:
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
    db_session.commit()
    return segment


def test_room_plan_flags_invalid_rows(db_session: Session) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    _room_segment(db_session, tenant_id, workspace_id)

    csv_bytes = (
        ROOM_HEADER
        + ",F_1st_year_AC_2,2\n"
        + "R2,,2\n"
        + "R3,F_1st_year_AC_2,abc\n"
        + "R4,F_1st_year_AC_2,9\n"
        + "R5,UNKNOWN_SEGMENT,2\n"
    ).encode("utf-8")

    result = plan_room_import(db_session, workspace_id, tenant_id, csv_bytes)

    reasons = [error["reason"] for error in result.validation_errors]
    assert "required" in reasons
    assert "invalid_capacity" in reasons
    assert "unknown_segment" in reasons
    assert result.to_insert == []


def test_room_plan_flags_duplicate_and_capacity_updates(db_session: Session) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    segment = _room_segment(db_session, tenant_id, workspace_id)
    db_session.add(
        Room(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            segment_id=segment.id,
            room_id="R1",
            capacity=3,
            source="uploaded",
            is_active=True,
        )
    )
    db_session.commit()

    csv_bytes = (
        ROOM_HEADER
        + "R1,F_1st_year_AC_2,2\n"
        + "R1,F_1st_year_AC_2,2\n"
    ).encode("utf-8")
    result = plan_room_import(db_session, workspace_id, tenant_id, csv_bytes)

    assert result.to_update[0]["changes"]["capacity"] == {"old": "3", "new": "2"}
    assert result.validation_errors[0]["reason"] == "duplicate_room_id_in_file_for_segment"


def test_room_apply_flags_invalid_rows_and_duplicates(db_session: Session) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    _room_segment(db_session, tenant_id, workspace_id)

    csv_bytes = (
        ROOM_HEADER
        + ",F_1st_year_AC_2,2\n"
        + "R2,,2\n"
        + "R3,F_1st_year_AC_2,abc\n"
        + "R4,UNKNOWN_SEGMENT,2\n"
        + "R5,F_1st_year_AC_2,3\n"
        + "R6,F_1st_year_AC_2,2\n"
        + "R6,F_1st_year_AC_2,2\n"
    ).encode("utf-8")
    result = apply_room_import(db_session, workspace_id, tenant_id, csv_bytes)

    reasons = [error["reason"] for error in result.errors]
    assert "required" in reasons
    assert "invalid_capacity" in reasons
    assert "unknown_segment" in reasons
    assert "capacity_must_match_segment_room_size" in reasons
    assert "duplicate_room_id_in_file_for_segment" in reasons
    assert result.inserted == 1


def test_room_plan_reports_unchanged_updates_and_soft_deletes(db_session: Session) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    segment = _room_segment(db_session, tenant_id, workspace_id)
    db_session.add_all(
        [
            Room(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                segment_id=segment.id,
                room_id="SAME",
                capacity=2,
                source="uploaded",
                is_active=True,
            ),
            Room(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                segment_id=segment.id,
                room_id="OLD",
                capacity=2,
                source="uploaded",
                is_active=True,
            ),
        ]
    )
    db_session.commit()

    csv_bytes = (
        ROOM_HEADER
        + "SAME,F_1st_year_AC_2,2\n"
        + "CAP,F_1st_year_AC_2,3\n"
    ).encode("utf-8")
    result = plan_room_import(db_session, workspace_id, tenant_id, csv_bytes)

    assert result.unchanged == ["F_1st_year_AC_2_SAME"]
    assert result.validation_errors[0]["reason"] == "capacity_must_match_segment_room_size"
    assert [row["room_id"] for row in result.to_soft_delete] == ["OLD"]
    assert result.workspace_warnings == [
        "Removing 1 room(s) from the active inventory."
    ]


def test_room_apply_updates_reactivates_and_soft_deletes(db_session: Session) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    segment = _room_segment(db_session, tenant_id, workspace_id)
    db_session.add_all(
        [
            Room(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                segment_id=segment.id,
                room_id="CHG",
                capacity=3,
                source="uploaded",
                is_active=True,
            ),
            Room(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                segment_id=segment.id,
                room_id="REV",
                capacity=2,
                source="uploaded",
                is_active=False,
            ),
            Room(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                segment_id=segment.id,
                room_id="OLD",
                capacity=2,
                source="uploaded",
                is_active=True,
            ),
        ]
    )
    db_session.commit()

    csv_bytes = (
        ROOM_HEADER + "CHG,F_1st_year_AC_2,2\n" + "REV,F_1st_year_AC_2,2\n"
    ).encode("utf-8")
    result = apply_room_import(db_session, workspace_id, tenant_id, csv_bytes)

    assert result.updated == 2
    assert result.soft_deleted == 1
    rooms = {room.room_id: room for room in db_session.query(Room).all()}
    assert rooms["CHG"].capacity == 2
    assert rooms["REV"].is_active is True
    assert rooms["OLD"].is_active is False


def test_room_apply_rejects_a_header_only_file_without_touching_the_room_list(
    db_session: Session,
) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    segment = _room_segment(db_session, tenant_id, workspace_id)
    room = Room(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        segment_id=segment.id,
        room_id="KEEP",
        capacity=2,
        source="uploaded",
        is_active=True,
    )
    db_session.add(room)
    db_session.commit()

    with pytest.raises(ValueError, match="no valid rows"):
        apply_room_import(db_session, workspace_id, tenant_id, ROOM_HEADER.encode("utf-8"))

    db_session.refresh(room)
    assert room.is_active is True


def test_room_apply_rejects_an_all_invalid_file_without_touching_the_room_list(
    db_session: Session,
) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    segment = _room_segment(db_session, tenant_id, workspace_id)
    room = Room(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        segment_id=segment.id,
        room_id="KEEP",
        capacity=2,
        source="uploaded",
        is_active=True,
    )
    db_session.add(room)
    db_session.commit()

    with pytest.raises(ValueError, match="no valid rows"):
        apply_room_import(
            db_session,
            workspace_id,
            tenant_id,
            (ROOM_HEADER + "BROKEN,F_1st_year_AC_2,abc\n").encode("utf-8"),
        )

    db_session.refresh(room)
    assert room.is_active is True


# ---------------------------------------------------------------------------
# form_response: option validation, ordering and answer normalisation
# ---------------------------------------------------------------------------


def test_ingest_form_response_rejects_invalid_option(db_session: Session) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    _student(db_session, tenant_id, workspace_id, admission_number="OPT001")
    answers = dict(ANSWERS)
    answers["q2_raw"] = "Not an option"

    with pytest.raises(FormIntakeError) as exc_info:
        ingest_form_response(db_session, workspace_id, "OPT001", "3210", answers)

    assert exc_info.value.code == "invalid_form_option"
    stored = db_session.query(FormResponse).one()
    assert stored.invalid_reason == "invalid_option_for_q2_raw"


def test_ingest_form_response_keeps_newer_profile_active(db_session: Session) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    _student(db_session, tenant_id, workspace_id, admission_number="ORD001")

    first = ingest_form_response(
        db_session,
        workspace_id,
        "ORD001",
        "3210",
        ANSWERS,
        submitted_at=datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
    )
    second = ingest_form_response(
        db_session,
        workspace_id,
        "ORD001",
        "3210",
        {**ANSWERS, "q1_raw": "11 PM - 1 AM (normal)"},
        submitted_at=datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc),
    )

    assert first["is_active"] is True
    assert second["is_active"] is False


def test_answer_normalisation_and_encoding_guards() -> None:
    normalized = _normalize_raw_answers({"q1_raw": "  value  ", "q2_raw": "   ", "q3_raw": None})
    assert normalized["q1_raw"] == "value"
    assert normalized["q2_raw"] is None
    assert normalized["q3_raw"] is None

    with pytest.raises(ValueError, match="Missing required answer for q1_raw"):
        _build_encoded_answers({})


# ---------------------------------------------------------------------------
# form_response_csv
# ---------------------------------------------------------------------------


def test_ingest_form_responses_csv_reports_row_level_errors(
    db_session: Session, tmp_path
) -> None:
    import csv
    import io

    tenant_id, workspace_id = _workspace(db_session)
    _student(db_session, tenant_id, workspace_id, admission_number="CSV001")

    question_keys = list(ANSWERS)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["admission_number", "phone_last4", *question_keys])

    def _row(admission: str, phone: str, **overrides) -> None:
        answers = {**ANSWERS, **overrides}
        writer.writerow([admission, phone, *answers.values()])

    _row("CSV001", "3210")
    _row("CSV001", "3210")
    _row("", "3210")
    _row("CSV002", "")
    _row("CSV002", "3210", q1_raw="invalid option")
    _row("GHOST999", "3210")

    csv_path = tmp_path / "responses.csv"
    csv_path.write_text(buffer.getvalue(), encoding="utf-8")

    result = ingest_form_responses_csv(db_session, workspace_id, str(csv_path))

    assert result["accepted_rows"] == 1
    assert result["rejected_rows"] == 5
    assert result["duplicate_rows"] == 1
    reasons = {row["reason"] for row in result["invalid_rows"]}
    assert "required" in reasons
    assert "duplicate_admission_number_in_file" in reasons
    assert "admission_number_not_found" in reasons


def test_ingest_form_responses_csv_missing_file(db_session: Session, tmp_path) -> None:
    _, workspace_id = _workspace(db_session)
    with pytest.raises(FileNotFoundError):
        ingest_form_responses_csv(db_session, workspace_id, str(tmp_path / "nope.csv"))


def test_ingest_form_responses_csv_accepts_headers_with_a_space_after_the_comma(
    db_session: Session, tmp_path
) -> None:
    import csv
    import io

    tenant_id, workspace_id = _workspace(db_session)
    _student(db_session, tenant_id, workspace_id, admission_number="CSVSPACE")

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([f" {name}" for name in ["admission_number", "phone_last4", *ANSWERS]])
    writer.writerow(["CSVSPACE", "3210", *ANSWERS.values()])
    csv_path = tmp_path / "spaced.csv"
    csv_path.write_text(buffer.getvalue(), encoding="utf-8")

    result = ingest_form_responses_csv(db_session, workspace_id, str(csv_path))

    assert result["accepted_rows"] == 1


def test_ingest_form_responses_csv_empty_and_wrong_header(
    db_session: Session, tmp_path
) -> None:
    tenant_id, workspace_id = _workspace(db_session)
    assert tenant_id is not None

    empty = tmp_path / "empty.csv"
    empty.write_text("", encoding="utf-8")
    with pytest.raises(ValueError, match="missing header row"):
        ingest_form_responses_csv(db_session, workspace_id, str(empty))

    wrong = tmp_path / "wrong.csv"
    wrong.write_text("admission_number\nA1\n", encoding="utf-8")
    with pytest.raises(ValueError, match="Missing required columns"):
        ingest_form_responses_csv(db_session, workspace_id, str(wrong))
