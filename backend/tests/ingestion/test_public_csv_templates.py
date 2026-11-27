from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.room import Room
from app.models.segment import Segment
from app.services.ingestion.room_csv import apply_room_import
from app.services.ingestion.student_csv import apply_student_import

TEMPLATES = Path(__file__).resolve().parents[3] / "frontend" / "public" / "templates"


def _template_bytes(name: str) -> bytes:
    return (TEMPLATES / name).read_bytes()


def test_public_students_template_imports(db_session: Session, seed_tenant_and_user) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]

    result = apply_student_import(
        db_session, workspace_id, tenant_id, _template_bytes("students.csv")
    )

    assert result.inserted == 3
    assert result.segments_created == 2
    assert result.errors == []

    segment_keys = db_session.scalars(
        select(Segment.segment_key).where(Segment.workspace_id == workspace_id)
    ).all()
    assert sorted(segment_keys) == ["F_1st_year_AC_2", "M_2nd_year_NonAC_3"]


def test_public_rooms_template_imports_into_student_segments(
    db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]

    apply_student_import(db_session, workspace_id, tenant_id, _template_bytes("students.csv"))
    result = apply_room_import(
        db_session, workspace_id, tenant_id, _template_bytes("rooms.csv")
    )

    assert result.inserted == 3
    assert result.errors == []

    rooms = db_session.scalars(select(Room).where(Room.workspace_id == workspace_id)).all()
    assert sorted(room.room_id for room in rooms) == ["F-101", "F-102", "M-201"]
    assert all(room.is_active for room in rooms)
