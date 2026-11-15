from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.room import Room
from app.models.segment import Segment
from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.services.ingestion.room_csv import (
    _parse_capacity,
    apply_room_import,
    plan_room_import,
)


def _seed_workspace(db_session: Session) -> tuple[uuid.UUID, uuid.UUID]:
    tenant = Tenant(slug=f"tenant-{uuid.uuid4().hex[:8]}", display_name="Test")
    db_session.add(tenant)
    db_session.flush()
    workspace = Workspace(tenant_id=tenant.id, name="Test WS", status="draft", source="manual")
    db_session.add(workspace)
    db_session.flush()
    return tenant.id, workspace.id


def _seed_segment(
    db_session: Session,
    tenant_id: uuid.UUID,
    workspace_id: uuid.UUID,
    *,
    segment_key: str = "F_1st_year_AC_2",
    room_size: int = 2,
) -> Segment:
    segment = Segment(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        segment_key=segment_key,
        gender="F",
        year_group="1st_year",
        ac_type="AC",
        room_size=room_size,
    )
    db_session.add(segment)
    db_session.flush()
    return segment


def _csv_bytes(content: str) -> bytes:
    return content.encode("utf-8")


def test_parse_capacity_rejects_non_digit_value() -> None:
    assert _parse_capacity("two") is None


def test_parse_capacity_rejects_unsupported_room_size() -> None:
    assert _parse_capacity("5") is None
    assert _parse_capacity("2") == 2


def test_plan_room_import_reports_blank_fields(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    _seed_segment(db_session, tenant_id, workspace_id)

    result = plan_room_import(db_session, workspace_id, tenant_id, _csv_bytes("room_id,segment_key,capacity\n,,\n"))

    reasons = {error["reason"] for error in result.validation_errors}
    assert reasons == {"required", "invalid_capacity"}
    assert result.valid_csv_rows == 0


def test_plan_room_import_reports_duplicate_room_id_in_file(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    _seed_segment(db_session, tenant_id, workspace_id)
    csv_content = (
        "room_id,segment_key,capacity\n"
        "A101,F_1st_year_AC_2,2\n"
        "A101,F_1st_year_AC_2,2\n"
    )

    result = plan_room_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))

    assert result.valid_csv_rows == 1
    assert [error["reason"] for error in result.validation_errors] == [
        "duplicate_room_id_in_file_for_segment"
    ]


def test_plan_room_import_marks_capacity_change_as_update(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    segment = _seed_segment(db_session, tenant_id, workspace_id, room_size=3)
    db_session.add(
        Room(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            segment_id=segment.id,
            room_id="A101",
            capacity=2,
            source="uploaded",
            is_active=True,
        )
    )
    db_session.flush()

    result = plan_room_import(
        db_session,
        workspace_id,
        tenant_id,
        _csv_bytes("room_id,segment_key,capacity\nA101,F_1st_year_AC_2,3\n"),
    )

    assert result.to_update == [
        {
            "room_id": "A101",
            "segment_key": "F_1st_year_AC_2",
            "action": "update",
            "changes": {"capacity": {"old": "2", "new": "3"}},
            "warnings": [],
        }
    ]


def test_apply_room_import_reports_blank_fields(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    _seed_segment(db_session, tenant_id, workspace_id)

    result = apply_room_import(db_session, workspace_id, tenant_id, _csv_bytes("room_id,segment_key,capacity\n,,\n"))

    reasons = [error["reason"] for error in result.errors]
    assert reasons == ["required", "required", "invalid_capacity"]
    assert result.inserted == 0


def test_apply_room_import_reports_unknown_segment(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)

    result = apply_room_import(
        db_session,
        workspace_id,
        tenant_id,
        _csv_bytes("room_id,segment_key,capacity\nA101,UNKNOWN_SEGMENT,2\n"),
    )

    assert [error["reason"] for error in result.errors] == ["unknown_segment"]
    assert result.inserted == 0


def test_apply_room_import_reports_capacity_mismatch(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    _seed_segment(db_session, tenant_id, workspace_id, room_size=2)

    result = apply_room_import(
        db_session,
        workspace_id,
        tenant_id,
        _csv_bytes("room_id,segment_key,capacity\nA101,F_1st_year_AC_2,3\n"),
    )

    assert [error["reason"] for error in result.errors] == ["capacity_must_match_segment_room_size"]


def test_apply_room_import_reports_duplicate_room_id_in_file(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    _seed_segment(db_session, tenant_id, workspace_id)
    csv_content = (
        "room_id,segment_key,capacity\n"
        "A101,F_1st_year_AC_2,2\n"
        "A101,F_1st_year_AC_2,2\n"
    )

    result = apply_room_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))

    assert result.inserted == 1
    assert [error["reason"] for error in result.errors] == ["duplicate_room_id_in_file_for_segment"]


def test_apply_room_import_updates_existing_capacity(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    segment = _seed_segment(db_session, tenant_id, workspace_id, room_size=3)
    room = Room(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        segment_id=segment.id,
        room_id="A101",
        capacity=2,
        source="uploaded",
        is_active=True,
    )
    db_session.add(room)
    db_session.flush()

    result = apply_room_import(
        db_session,
        workspace_id,
        tenant_id,
        _csv_bytes("room_id,segment_key,capacity\nA101,F_1st_year_AC_2,3\n"),
    )

    assert result.updated == 1
    assert result.inserted == 0
    stored = db_session.scalars(select(Room).where(Room.room_id == "A101")).one()
    assert stored.capacity == 3
