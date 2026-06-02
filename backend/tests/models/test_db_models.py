import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
import datetime
from app.models.tenant_membership import TenantMembership
from app.models.segment import Segment
from app.models.student import Student
from app.models.workspace import Workspace
from sqlalchemy import text


def test_segment_cascade_deletion(db_session: Session, seed_tenant_and_user):
    db_session.execute(text("PRAGMA foreign_keys=ON"))
    tenant_id = seed_tenant_and_user["tenant_id"]
    ws = Workspace(tenant_id=tenant_id, name="WS CASCADE", status="draft", source="manual")
    db_session.add(ws)
    db_session.commit()

    seg = Segment(tenant_id=tenant_id, workspace_id=ws.id, segment_key="CASCADE-M", gender="M", year_group="1", ac_type="N", room_size=2)
    db_session.add(seg)
    db_session.commit()

    stu = Student(tenant_id=tenant_id, workspace_id=ws.id, segment_id=seg.id, admission_number="CASCADE-STU", full_name="Student", gender="M", year_group="1", ac_type="N", room_size=2, dob=datetime.date(2000, 1, 1), phone_last4="1234", is_active=True)
    db_session.add(stu)
    db_session.commit()

    stu_id = stu.id

    # Delete segment and assert cascade
    db_session.delete(seg)
    db_session.commit()

    # Assert student is deleted
    assert db_session.query(Student).filter_by(id=stu_id).first() is None


def test_duplicate_tenant_membership_rejection(db_session: Session, seed_tenant_and_user):
    tenant_id = seed_tenant_and_user["tenant_id"]
    supabase_user_id = seed_tenant_and_user["supabase_user_id"]

    tm2 = TenantMembership(tenant_id=tenant_id, supabase_user_id=supabase_user_id, email="test2@test.com", role="admin")
    db_session.add(tm2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
