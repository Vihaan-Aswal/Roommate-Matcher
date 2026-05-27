import uuid
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.models.segment import Segment
from app.models.room import Room
from app.services.ingestion.room_csv import apply_room_import

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

def test_apply_inserts_rooms(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    seg1 = Segment(tenant_id=tenant_id, workspace_id=workspace_id, segment_key="F_1st_year_AC_2", gender="F", year_group="1st_year", ac_type="AC", room_size=2)
    db_session.add(seg1)
    db_session.flush()

    csv_content = (
        "room_id,segment_key,capacity\n"
        "A101,F_1st_year_AC_2,2\n"
        "A102,F_1st_year_AC_2,2\n"
    )

    result = apply_room_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert result.inserted == 2
    assert result.updated == 0
    assert result.soft_deleted == 0
    
    rooms = db_session.scalars(select(Room).where(Room.workspace_id == workspace_id)).all()
    assert len(rooms) == 2
    assert all(r.is_active for r in rooms)

def test_apply_soft_deletes_missing_rooms(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    seg1 = Segment(tenant_id=tenant_id, workspace_id=workspace_id, segment_key="F_1st_year_AC_2", gender="F", year_group="1st_year", ac_type="AC", room_size=2)
    db_session.add(seg1)
    db_session.flush()
    r1 = Room(tenant_id=tenant_id, workspace_id=workspace_id, segment_id=seg1.id, room_id="A101", capacity=2, source="uploaded", is_active=True)
    r2 = Room(tenant_id=tenant_id, workspace_id=workspace_id, segment_id=seg1.id, room_id="A102", capacity=2, source="uploaded", is_active=True)
    db_session.add_all([r1, r2])
    db_session.flush()

    csv_content = (
        "room_id,segment_key,capacity\n"
        "A101,F_1st_year_AC_2,2\n"
    )

    result = apply_room_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert result.soft_deleted == 1
    
    db_session.refresh(r2)
    assert r2.is_active is False
    assert r1.is_active is True

def test_apply_reactivates_room(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    seg1 = Segment(tenant_id=tenant_id, workspace_id=workspace_id, segment_key="F_1st_year_AC_2", gender="F", year_group="1st_year", ac_type="AC", room_size=2)
    db_session.add(seg1)
    db_session.flush()
    r1 = Room(tenant_id=tenant_id, workspace_id=workspace_id, segment_id=seg1.id, room_id="A101", capacity=2, source="uploaded", is_active=False)
    db_session.add(r1)
    db_session.flush()

    csv_content = (
        "room_id,segment_key,capacity\n"
        "A101,F_1st_year_AC_2,2\n"
    )

    result = apply_room_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert result.updated == 1
    assert result.inserted == 0
    db_session.refresh(r1)
    assert r1.is_active is True

def test_apply_idempotent(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    seg1 = Segment(tenant_id=tenant_id, workspace_id=workspace_id, segment_key="F_1st_year_AC_2", gender="F", year_group="1st_year", ac_type="AC", room_size=2)
    db_session.add(seg1)
    db_session.flush()

    csv_content = (
        "room_id,segment_key,capacity\n"
        "A101,F_1st_year_AC_2,2\n"
    )

    res1 = apply_room_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    assert res1.inserted == 1
    
    res2 = apply_room_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    assert res2.inserted == 0
    assert res2.unchanged == 1
