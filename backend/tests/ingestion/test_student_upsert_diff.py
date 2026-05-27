import uuid
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.models.segment import Segment
from app.models.student import Student
from app.models.form_response import FormResponse
from app.models.matching_run import MatchingRun
from app.services.ingestion.student_csv import plan_student_import
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

def test_plan_import_all_new_students(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    csv_content = (
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n"
        "ADM001,Alice,F,1st_year,AC,2,2005-01-15,9876543210\n"
        "ADM002,Bob,M,1st_year,AC,2,2005-03-22,9876543211\n"
        "ADM003,Charlie,M,1st_year,NonAC,3,2004-11-05,9876543212\n"
    )
    
    result = plan_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert result.total_csv_rows == 3
    assert result.valid_csv_rows == 3
    assert len(result.to_insert) == 3
    assert len(result.to_update) == 0
    assert len(result.to_soft_delete) == 0
    assert len(result.unchanged) == 0
    assert len(result.validation_errors) == 0

def test_plan_import_no_changes(db_session: Session) -> None:
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
        "ADM002,Bob,M,1st_year,AC,2,2005-03-22,9876543211\n"
    )

    result = plan_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert len(result.unchanged) == 2
    assert len(result.to_update) == 0
    assert len(result.to_insert) == 0
    assert len(result.to_soft_delete) == 0

def test_plan_import_update_name(db_session: Session) -> None:
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

    result = plan_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert len(result.to_update) == 1
    assert result.to_update[0]["changes"]["full_name"] == {"old": "Old Name", "new": "New Name"}

def test_plan_import_soft_delete(db_session: Session) -> None:
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

    result = plan_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert len(result.to_soft_delete) == 1
    assert result.to_soft_delete[0]["admission_number"] == "ADM002"

def test_plan_import_soft_delete_warns_about_responses(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    seg = Segment(tenant_id=tenant_id, workspace_id=workspace_id, segment_key="F_1st_year_AC_2", gender="F", year_group="1st_year", ac_type="AC", room_size=2)
    db_session.add(seg)
    db_session.flush()
    s1 = Student(tenant_id=tenant_id, workspace_id=workspace_id, segment_id=seg.id, admission_number="ADM002", full_name="Bob", gender="M", year_group="1st_year", ac_type="AC", room_size=2, dob=date(2005, 3, 22), phone_number="9876543211", phone_last4="3211", is_active=True)
    db_session.add(s1)
    db_session.flush()
    
    from datetime import datetime, timezone
    fr = FormResponse(
        tenant_id=tenant_id, 
        workspace_id=workspace_id, 
        student_id=s1.id,
        submitted_admission_number="ADM001",
        submitted_phone_last4="3210",
        submitted_at=datetime.now(timezone.utc),
        validation_status="valid"
    )
    fr2 = FormResponse(
        tenant_id=tenant_id, 
        workspace_id=workspace_id, 
        student_id=s1.id,
        submitted_admission_number="ADM001",
        submitted_phone_last4="3210",
        submitted_at=datetime.now(timezone.utc),
        validation_status="valid"
    )
    db_session.add_all([fr, fr2])
    db_session.flush()

    csv_content = (
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n"
    )

    result = plan_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert len(result.to_soft_delete) == 1
    assert result.to_soft_delete[0]["admission_number"] == "ADM002"
    assert "has 2 form response(s)" in result.to_soft_delete[0]["warnings"][0]

def test_plan_import_soft_delete_warns_about_matching_runs(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    seg = Segment(tenant_id=tenant_id, workspace_id=workspace_id, segment_key="F_1st_year_AC_2", gender="F", year_group="1st_year", ac_type="AC", room_size=2)
    db_session.add(seg)
    db_session.flush()
    s1 = Student(tenant_id=tenant_id, workspace_id=workspace_id, segment_id=seg.id, admission_number="ADM001", full_name="Bob", gender="M", year_group="1st_year", ac_type="AC", room_size=2, dob=date(2005, 3, 22), phone_number="9876543211", phone_last4="3211", is_active=True)
    db_session.add(s1)
    db_session.flush()
    
    mr = MatchingRun(tenant_id=tenant_id, workspace_id=workspace_id, run_id="mr-1234", scope="segment", status="completed")
    db_session.add(mr)
    db_session.flush()

    csv_content = (
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n"
    )

    result = plan_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert len(result.to_soft_delete) == 1
    assert "included in existing matching run(s)" in result.to_soft_delete[0]["warnings"][0]

def test_plan_import_phone_number_required(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    csv_content = (
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob\n"
        "ADM001,Alice,F,1st_year,AC,2,2005-01-15\n"
    )
    
    with pytest.raises(ValueError, match="Missing required columns.*phone_number"):
        plan_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))

def test_plan_import_invalid_phone_rejected(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    csv_content = (
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n"
        "ADM001,Alice,F,1st_year,AC,2,2005-01-15,12\n"
    )
    
    result = plan_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert len(result.validation_errors) == 1
    assert result.validation_errors[0]["reason"] == "invalid_phone_number_min_4_digits"

def test_plan_import_duplicate_in_file(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    csv_content = (
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n"
        "ADM001,Alice,F,1st_year,AC,2,2005-01-15,9876543210\n"
        "ADM001,Alice,F,1st_year,AC,2,2005-01-15,9876543210\n"
    )
    
    result = plan_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert result.valid_csv_rows == 1
    assert len(result.validation_errors) == 1
    assert result.validation_errors[0]["reason"] == "duplicate_admission_number_in_file"

def test_plan_import_mixed_scenario(db_session: Session) -> None:
    tenant_id, workspace_id = _seed_workspace(db_session)
    seg = Segment(tenant_id=tenant_id, workspace_id=workspace_id, segment_key="F_1st_year_AC_2", gender="F", year_group="1st_year", ac_type="AC", room_size=2)
    db_session.add(seg)
    db_session.flush()
    s1 = Student(tenant_id=tenant_id, workspace_id=workspace_id, segment_id=seg.id, admission_number="ADM001", full_name="Alice", gender="F", year_group="1st_year", ac_type="AC", room_size=2, dob=date(2005, 1, 15), phone_number="9876543210", phone_last4="3210", is_active=True)
    s2 = Student(tenant_id=tenant_id, workspace_id=workspace_id, segment_id=seg.id, admission_number="ADM002", full_name="Bob", gender="M", year_group="1st_year", ac_type="AC", room_size=2, dob=date(2005, 3, 22), phone_number="9876543211", phone_last4="3211", is_active=True)
    s3 = Student(tenant_id=tenant_id, workspace_id=workspace_id, segment_id=seg.id, admission_number="ADM003", full_name="Charlie", gender="M", year_group="1st_year", ac_type="AC", room_size=2, dob=date(2005, 3, 22), phone_number="9876543212", phone_last4="3212", is_active=True)
    db_session.add_all([s1, s2, s3])
    db_session.flush()

    csv_content = (
        "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number\n"
        "ADM001,Alice,F,1st_year,AC,2,2005-01-15,9876543210\n" # unchanged
        "ADM002,Bob Updated,M,1st_year,AC,2,2005-03-22,9876543211\n" # update
        "ADM004,Diana,F,1st_year,AC,2,2005-03-22,9876543213\n" # insert
        # ADM003 is missing (soft delete)
    )

    result = plan_student_import(db_session, workspace_id, tenant_id, _csv_bytes(csv_content))
    
    assert len(result.unchanged) == 1
    assert len(result.to_update) == 1
    assert len(result.to_insert) == 1
    assert len(result.to_soft_delete) == 1
