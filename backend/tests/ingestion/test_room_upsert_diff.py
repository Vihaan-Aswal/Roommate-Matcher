import uuid
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.models.segment import Segment
from app.models.room import Room
from app.services.ingestion.room_csv import plan_room_import

def _seed_workspace(db_session: Session) -> tuple[uuid.UUID, uuid.UUID]:
    tenant = Tenant(slug="test-tenant", display_name="Test")
    db_session.add(tenant)
    db_session.flush()
    workspace = Workspace(tenant_id=tenant.id, name="Test WS", status="draft", source="manual")
    db_session.add(workspace)
    db_session.flush()
    return tenant.id, workspace.id

def _csv_bytes(content: str) -> bytes:
    return content.encode("utf-8")

def test_plan_room_import_all_new(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    seg1 = Segment(tenant_id=tenant_id, workspace_id=workspace_id, segment_key="F_1st_year_AC_2", gender="F", year_group="1st_year", ac_type="AC", room_size=2)
    db_session.add(seg1)
    db_session.flush()

    csv_content = (
        "room_id,segment_key,capacity\n"
        "A101,F_1st_year_AC_2,2\n"
        "A102,F_1st_year_AC_2,2\n"
        "A103,F_1st_year_AC_2,2\n"
    )

    result = plan_room_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert len(result.to_insert) == 3
    assert len(result.to_update) == 0
    assert len(result.to_soft_delete) == 0
    assert len(result.unchanged) == 0
    assert len(result.validation_errors) == 0

def test_plan_room_import_soft_delete(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    seg1 = Segment(tenant_id=tenant_id, workspace_id=workspace_id, segment_key="F_1st_year_AC_2", gender="F", year_group="1st_year", ac_type="AC", room_size=2)
    db_session.add(seg1)
    db_session.flush()
    r1 = Room(tenant_id=tenant_id, workspace_id=workspace_id, segment_id=seg1.id, room_id="A101", capacity=2, source="uploaded")
    db_session.add(r1)
    db_session.flush()

    csv_content = (
        "room_id,segment_key,capacity\n"
    )

    result = plan_room_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert len(result.to_soft_delete) == 1
    assert result.to_soft_delete[0]["room_id"] == "A101"

def test_plan_room_import_unchanged(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    seg1 = Segment(tenant_id=tenant_id, workspace_id=workspace_id, segment_key="F_1st_year_AC_2", gender="F", year_group="1st_year", ac_type="AC", room_size=2)
    db_session.add(seg1)
    db_session.flush()
    r1 = Room(tenant_id=tenant_id, workspace_id=workspace_id, segment_id=seg1.id, room_id="A101", capacity=2, source="uploaded")
    db_session.add(r1)
    db_session.flush()

    csv_content = (
        "room_id,segment_key,capacity\n"
        "A101,F_1st_year_AC_2,2\n"
    )

    result = plan_room_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert len(result.unchanged) == 1
    assert len(result.to_update) == 0
    assert len(result.to_insert) == 0
    assert len(result.to_soft_delete) == 0

def test_plan_room_import_unknown_segment(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    
    csv_content = (
        "room_id,segment_key,capacity\n"
        "A101,UNKNOWN_SEGMENT,2\n"
    )

    result = plan_room_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert len(result.validation_errors) == 1
    assert result.validation_errors[0]["reason"] == "unknown_segment"

def test_plan_room_import_capacity_mismatch(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    seg1 = Segment(tenant_id=tenant_id, workspace_id=workspace_id, segment_key="F_1st_year_AC_2", gender="F", year_group="1st_year", ac_type="AC", room_size=2)
    db_session.add(seg1)
    db_session.flush()
    
    csv_content = (
        "room_id,segment_key,capacity\n"
        "A101,F_1st_year_AC_2,3\n"
    )

    result = plan_room_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert len(result.validation_errors) == 1
    assert result.validation_errors[0]["reason"] == "capacity_must_match_segment_room_size"
