import uuid
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.models.segment import Segment
from app.models.student import Student
from app.models.form_response import FormResponse
from app.services.ingestion.student_csv import apply_student_import
from datetime import date

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

def test_apply_inserts_new_students(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    csv_content = (
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n"
        "ADM001,Alice,F,1st_year,AC,2,2005-01-15,9876543210\n"
        "ADM002,Bob,M,1st_year,AC,2,2005-03-22,9876543211\n"
    )
    
    result = apply_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert result.inserted == 2
    assert result.updated == 0
    assert result.soft_deleted == 0
    assert result.unchanged == 0
    
    students = db_session.scalars(select(Student).where(Student.workspace_id == workspace_id)).all()
    assert len(students) == 2
    assert all(s.is_active for s in students)

def test_apply_updates_existing_student(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    seg = Segment(tenant_id=tenant_id, workspace_id=workspace_id, segment_key="F_1st_year_AC_2", gender="F", year_group="1st_year", ac_type="AC", room_size=2)
    db_session.add(seg)
    db_session.flush()
    s1 = Student(tenant_id=tenant_id, workspace_id=workspace_id, segment_id=seg.id, admission_number="ADM001", full_name="Old Name", gender="F", year_group="1st_year", ac_type="AC", room_size=2, dob=date(2005, 1, 15), phone_number="9876543210", phone_last4="3210", is_active=True)
    db_session.add(s1)
    db_session.flush()

    csv_content = (
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n"
        "ADM001,New Name,F,1st_year,AC,2,2005-01-15,9876543210\n"
    )

    result = apply_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert result.updated == 1
    db_session.refresh(s1)
    assert s1.full_name == "New Name"

def test_apply_soft_deletes_missing_students(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    seg = Segment(tenant_id=tenant_id, workspace_id=workspace_id, segment_key="F_1st_year_AC_2", gender="F", year_group="1st_year", ac_type="AC", room_size=2)
    db_session.add(seg)
    db_session.flush()
    s1 = Student(tenant_id=tenant_id, workspace_id=workspace_id, segment_id=seg.id, admission_number="ADM001", full_name="Alice", gender="F", year_group="1st_year", ac_type="AC", room_size=2, dob=date(2005, 1, 15), phone_number="9876543210", phone_last4="3210", is_active=True)
    s2 = Student(tenant_id=tenant_id, workspace_id=workspace_id, segment_id=seg.id, admission_number="ADM002", full_name="Bob", gender="M", year_group="1st_year", ac_type="AC", room_size=2, dob=date(2005, 3, 22), phone_number="9876543211", phone_last4="3211", is_active=True)
    db_session.add_all([s1, s2])
    db_session.flush()

    csv_content = (
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n"
        "ADM001,Alice,F,1st_year,AC,2,2005-01-15,9876543210\n"
    )

    result = apply_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert result.soft_deleted == 1
    db_session.refresh(s2)
    assert s2.is_active is False
    assert s1.is_active is True

def test_apply_preserves_form_responses_on_soft_delete(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    seg = Segment(tenant_id=tenant_id, workspace_id=workspace_id, segment_key="F_1st_year_AC_2", gender="F", year_group="1st_year", ac_type="AC", room_size=2)
    db_session.add(seg)
    db_session.flush()
    s2 = Student(tenant_id=tenant_id, workspace_id=workspace_id, segment_id=seg.id, admission_number="ADM002", full_name="Bob", gender="M", year_group="1st_year", ac_type="AC", room_size=2, dob=date(2005, 3, 22), phone_number="9876543211", phone_last4="3211", is_active=True)
    db_session.add(s2)
    db_session.flush()

    from datetime import datetime, timezone
    fr = FormResponse(
        tenant_id=tenant_id, 
        workspace_id=workspace_id, 
        student_id=s2.id, 
        submitted_admission_number="ADM002",
        submitted_phone_last4="3211",
        submitted_at=datetime.now(timezone.utc),
        validation_status="valid"
    )
    db_session.add(fr)
    db_session.flush()

    csv_content = (
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n"
    )

    apply_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    db_session.refresh(fr)
    db_session.refresh(s2)
    assert s2.is_active is False
    assert fr.student_id == s2.id

def test_apply_reactivates_previously_deleted_student(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    seg = Segment(tenant_id=tenant_id, workspace_id=workspace_id, segment_key="F_1st_year_AC_2", gender="F", year_group="1st_year", ac_type="AC", room_size=2)
    db_session.add(seg)
    db_session.flush()
    s1 = Student(tenant_id=tenant_id, workspace_id=workspace_id, segment_id=seg.id, admission_number="ADM001", full_name="Alice", gender="F", year_group="1st_year", ac_type="AC", room_size=2, dob=date(2005, 1, 15), phone_number="9876543210", phone_last4="3210", is_active=False)
    db_session.add(s1)
    db_session.flush()

    csv_content = (
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n"
        "ADM001,Alice Reactivated,F,1st_year,AC,2,2005-01-15,9876543210\n"
    )

    result = apply_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert result.updated == 1
    assert result.inserted == 0
    db_session.refresh(s1)
    assert s1.is_active is True
    assert s1.full_name == "Alice Reactivated"

def test_apply_creates_new_segments(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    csv_content = (
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n"
        "ADM001,Alice,F,1st_year,AC,2,2005-01-15,9876543210\n"
    )
    
    result = apply_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert result.segments_created == 1
    segs = db_session.scalars(select(Segment).where(Segment.workspace_id == workspace_id)).all()
    assert len(segs) == 1
    assert segs[0].segment_key == "F_1st_year_AC_2"

def test_apply_updates_segment_fk(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    seg1 = Segment(tenant_id=tenant_id, workspace_id=workspace_id, segment_key="F_1st_year_AC_2", gender="F", year_group="1st_year", ac_type="AC", room_size=2)
    db_session.add(seg1)
    db_session.flush()
    s1 = Student(tenant_id=tenant_id, workspace_id=workspace_id, segment_id=seg1.id, admission_number="ADM001", full_name="Alice", gender="F", year_group="1st_year", ac_type="AC", room_size=2, dob=date(2005, 1, 15), phone_number="9876543210", phone_last4="3210", is_active=True)
    db_session.add(s1)
    db_session.flush()

    csv_content = (
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n"
        "ADM001,Alice,F,2nd_year,AC,2,2005-01-15,9876543210\n"
    )

    apply_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    db_session.refresh(s1)
    seg2 = db_session.scalar(select(Segment).where(Segment.id == s1.segment_id))
    assert seg2.segment_key == "F_2nd_year_AC_2"
    assert s1.year_group == "2nd_year"

def test_apply_phone_last4_derived_correctly(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    csv_content = (
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n"
        "ADM001,Alice,F,1st_year,AC,2,2005-01-15,9876543210\n"
    )
    
    apply_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    s = db_session.scalar(select(Student).where(Student.admission_number == "ADM001"))
    assert s.phone_last4 == "3210"

def test_apply_idempotent(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    csv_content = (
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n"
        "ADM001,Alice,F,1st_year,AC,2,2005-01-15,9876543210\n"
    )
    
    res1 = apply_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    assert res1.inserted == 1
    
    res2 = apply_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    assert res2.inserted == 0
    assert res2.unchanged == 1

def test_apply_commits_atomically(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    csv_content = (
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n"
        "ADM001,Alice,F,1st_year,AC,2,2005-01-15,9876543210\n"
        "ADM002,Bob,M,1st_year,AC,2,2005-01-15,12\n"  # invalid phone
        "ADM003,Charlie,M,1st_year,AC,2,2005-01-15,9876543212\n"
    )
    
    result = apply_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert result.inserted == 2
    assert len(result.errors) == 1
    
    students = db_session.scalars(select(Student).where(Student.workspace_id == workspace_id)).all()
    assert len(students) == 2
