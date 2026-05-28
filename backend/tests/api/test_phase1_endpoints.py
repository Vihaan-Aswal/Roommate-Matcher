from datetime import date
from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.form_response import FormResponse
from app.models.preference_profile import PreferenceProfile
from app.models.room import Room
from app.models.segment import Segment
from app.models.student import Student


def _seed_student(db_session: Session, admission_number: str = "ADM200", tenant_id=None, workspace_id=None) -> Student:
    import uuid
    tenant_id = tenant_id or uuid.uuid4()
    workspace_id = workspace_id or uuid.uuid4()
    segment = Segment(tenant_id=tenant_id, workspace_id=workspace_id, segment_key="M_1st_year_AC_2",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
    )
    db_session.add(segment)
    db_session.flush()
    student = Student(tenant_id=tenant_id, workspace_id=workspace_id, admission_number=admission_number,
        full_name="API Student",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
        dob=date(2005, 1, 1),
        segment_id=segment.id,
        phone_number="9876543210",
        phone_last4="3210",
        is_active=True,
    )
    db_session.add(student)
    db_session.commit()
    return student


def test_form_submit_success(client: TestClient, db_session: Session) -> None:
    student = _seed_student(db_session)

    response = client.post(
        "/api/form/submit",
        json={
            "workspace_id": str(student.workspace_id),
            "admission_number": "ADM200",
            "phone_last4": "3210",
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
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["has_preferences"] is True


def test_form_submit_phone_last4_mismatch_returns_400(client: TestClient, db_session: Session) -> None:
    student = _seed_student(db_session, admission_number="ADM201")

    response = client.post(
        "/api/form/submit",
        json={
            "workspace_id": str(student.workspace_id),
            "admission_number": "ADM201",
            "phone_last4": "9999",
            "q1_raw": "Before 11 PM (early)",
        },
    )

    assert response.status_code == 400
    payload = response.json()
    assert payload["detail"]["code"] == "phone_mismatch"


def test_form_submit_incomplete_submission_returns_400(client: TestClient, db_session: Session) -> None:
    student = _seed_student(db_session, admission_number="ADM205")

    response = client.post(
        "/api/form/submit",
        json={
            "workspace_id": str(student.workspace_id),
            "admission_number": "ADM205",
            "phone_last4": "3210",
            "q1_raw": "Before 11 PM (early)",
        },
    )

    assert response.status_code == 400
    payload = response.json()
    assert payload["detail"]["code"] == "incomplete_form_submission"


def test_segment_status_endpoint_returns_impossible(client: TestClient, db_session: Session, seed_tenant_and_user) -> None:
    auth_headers = seed_tenant_and_user["headers"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    tenant_id = seed_tenant_and_user["tenant_id"]
    student = _seed_student(db_session, admission_number="ADM202", tenant_id=tenant_id, workspace_id=workspace_id)
    db_session.add(
        Student(tenant_id=tenant_id, workspace_id=workspace_id, admission_number="ADM203",
            full_name="Second Student",
            gender="M",
            year_group="1st_year",
            ac_type="AC",
            room_size=2,
            dob=date(2005, 1, 2),
            segment_id=student.segment_id,
                phone_number="9876543210",
                phone_last4="3210",
                is_active=True,
            )
    )
    db_session.add(
        Student(tenant_id=tenant_id, workspace_id=workspace_id, admission_number="ADM204",
            full_name="Third Student",
            gender="M",
            year_group="1st_year",
            ac_type="AC",
            room_size=2,
            dob=date(2005, 1, 3),
            segment_id=student.segment_id,
                phone_number="9876543210",
                phone_last4="3210",
                is_active=True,
            )
    )
    db_session.add(Room(tenant_id=tenant_id, workspace_id=workspace_id, room_id="A-900", segment_id=student.segment_id, capacity=2, source="uploaded", is_active=True))
    db_session.commit()

    response = client.get(f"/api/workspaces/{student.workspace_id}/segments/M_1st_year_AC_2", headers=auth_headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "Impossible"


def test_segment_status_endpoint_ready_when_no_rooms_uploaded(client: TestClient, db_session: Session, seed_tenant_and_user) -> None:
    auth_headers = seed_tenant_and_user["headers"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    tenant_id = seed_tenant_and_user["tenant_id"]
    student = _seed_student(db_session, admission_number="ADM206", tenant_id=tenant_id, workspace_id=workspace_id)
    db_session.add(
        PreferenceProfile(tenant_id=tenant_id, workspace_id=workspace_id, student_id=student.id, has_preferences=1, is_active=True)
    )
    db_session.commit()

    response = client.get(f"/api/workspaces/{student.workspace_id}/segments/M_1st_year_AC_2", headers=auth_headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "Ready"
    assert payload["total_capacity"] == 1


def test_segment_status_endpoint_returns_404_for_unknown_segment(client: TestClient, seed_tenant_and_user) -> None:
    auth_headers = seed_tenant_and_user["headers"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    response = client.get(f"/api/workspaces/{workspace_id}/segments/UNKNOWN", headers=auth_headers)
    assert response.status_code == 404


def test_segments_list_endpoint_returns_segment_rows(client: TestClient, db_session: Session, seed_tenant_and_user) -> None:
    auth_headers = seed_tenant_and_user["headers"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    tenant_id = seed_tenant_and_user["tenant_id"]
    student = _seed_student(db_session, admission_number="ADM220", tenant_id=tenant_id, workspace_id=workspace_id)

    response = client.get(f"/api/workspaces/{student.workspace_id}/segments", headers=auth_headers)
    assert response.status_code == 200

    payload = response.json()
    assert "segments" in payload
    assert len(payload["segments"]) == 1
    row = payload["segments"][0]
    assert row["segment_key"] == "M_1st_year_AC_2"
    assert row["room_size"] == 2


def test_segment_students_endpoint_returns_valid_invalid_missing_statuses(
    client: TestClient,
    db_session: Session,
    seed_tenant_and_user
) -> None:
    auth_headers = seed_tenant_and_user["headers"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    tenant_id = seed_tenant_and_user["tenant_id"]
    student = _seed_student(db_session, admission_number="ADM230", tenant_id=tenant_id, workspace_id=workspace_id)
    import uuid
    st231 = Student(id=uuid.uuid4(), tenant_id=tenant_id, workspace_id=workspace_id, admission_number="ADM231",
        full_name="Invalid Form Student",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
        dob=date(2005, 1, 2),
        segment_id=student.segment_id,
        phone_number="9876543210",
        phone_last4="3210",
        is_active=True,
    )
    st232 = Student(id=uuid.uuid4(), tenant_id=tenant_id, workspace_id=workspace_id, admission_number="ADM232",
        full_name="Missing Form Student",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
        dob=date(2005, 1, 3),
        segment_id=student.segment_id,
        phone_number="9876543210",
        phone_last4="3210",
        is_active=True,
    )
    db_session.add_all([st231, st232])
    db_session.add(
        PreferenceProfile(tenant_id=tenant_id, workspace_id=workspace_id, student_id=student.id, has_preferences=1, is_active=True)
    )
    db_session.add(
        FormResponse(
            student_id=st231.id,
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            submitted_admission_number="ADM231",
            submitted_phone_last4="3210",
            submitted_at=datetime.now(timezone.utc),
            validation_status="invalid",
            invalid_reason="dob_mismatch",
        )
    )
    db_session.commit()

    response = client.get(f"/api/workspaces/{student.workspace_id}/segments/M_1st_year_AC_2/students", headers=auth_headers)
    assert response.status_code == 200

    payload = response.json()
    rows = {row["admission_number"]: row for row in payload["students"]}
    assert rows["ADM230"]["preference_status"] == "valid"
    assert rows["ADM230"]["has_valid_preferences"] is True
    assert rows["ADM231"]["preference_status"] == "invalid"
    assert rows["ADM231"]["has_valid_preferences"] is False
    assert rows["ADM232"]["preference_status"] == "missing"
    assert rows["ADM232"]["has_valid_preferences"] is False


def test_form_status_endpoint_returns_aggregate_counts(client: TestClient, db_session: Session) -> None:
    student = _seed_student(db_session, admission_number="ADM240")
    st241 = Student(id=__import__("uuid").uuid4(), tenant_id=__import__("uuid").uuid4(), workspace_id=student.workspace_id, admission_number="ADM241",
        full_name="Invalid Form Student",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
        dob=date(2005, 1, 2),
        segment_id=student.segment_id,
        phone_number="9876543210",
        phone_last4="3210",
        is_active=True,
    )
    st242 = Student(id=__import__("uuid").uuid4(), tenant_id=__import__("uuid").uuid4(), workspace_id=student.workspace_id, admission_number="ADM242",
        full_name="Missing Form Student",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
        dob=date(2005, 1, 3),
        segment_id=student.segment_id,
        phone_number="9876543210",
        phone_last4="3210",
        is_active=True,
    )
    db_session.add_all([st241, st242])
    db_session.add(
        PreferenceProfile(tenant_id=__import__("uuid").uuid4(), workspace_id=student.workspace_id, student_id=student.id, has_preferences=1, is_active=True)
    )
    db_session.add(
        FormResponse(
            student_id=st241.id,
            tenant_id=__import__("uuid").uuid4(),
            workspace_id=student.workspace_id,
            submitted_admission_number="ADM241",
            submitted_phone_last4="3210",
            submitted_at=datetime.now(timezone.utc),
            validation_status="invalid",
            invalid_reason="incomplete_form_submission",
        )
    )
    db_session.commit()

    # Create dummy user and mock require_workspace_access dependency
    from app.auth.dependencies import require_workspace_access
    from app.auth.contracts import AuthenticatedUser
    from app.models.tenant import Tenant
    from app.models.workspace import Workspace

    tenant = db_session.query(Tenant).filter_by(id=student.tenant_id).first()
    if not tenant:
        tenant = Tenant(id=student.tenant_id, slug="t1", display_name="T1")
        db_session.add(tenant)
    workspace = db_session.query(Workspace).filter_by(id=student.workspace_id).first()
    if not workspace:
        workspace = Workspace(id=student.workspace_id, tenant_id=tenant.id, name="W1")
        db_session.add(workspace)
    db_session.commit()
    
    user = AuthenticatedUser(
        auth_kind="app_jwt",
        tenant_id=tenant.id,
        supabase_user_id="user1",
        email="user@example.com",
        role="admin"
    )

    from app.main import app
    app.dependency_overrides[require_workspace_access] = lambda: (user, tenant, workspace)
    try:
        response = client.get(f"/api/workspaces/{student.workspace_id}/collection/status")
        assert response.status_code == 200

        payload = response.json()
        assert payload["total_students"] == 3
    finally:
        app.dependency_overrides.clear()
    assert payload["valid_responses"] == 1
    assert payload["invalid_responses"] == 1
    assert payload["percentage_valid"] == 33.33
    assert len(payload["by_segment"]) == 1
    assert payload["by_segment"][0]["segment_key"] == "M_1st_year_AC_2"


def test_non_submitters_endpoint_returns_students_without_valid_profiles(
    client: TestClient,
    db_session: Session,
) -> None:
    student = _seed_student(db_session, admission_number="ADM250")
    st251 = Student(id=__import__("uuid").uuid4(), tenant_id=__import__("uuid").uuid4(), workspace_id=student.workspace_id, admission_number="ADM251",
        full_name="Invalid Form Student",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
        dob=date(2005, 1, 2),
        segment_id=student.segment_id,
        phone_number="9876543210",
        phone_last4="3210",
        is_active=True,
    )
    st252 = Student(id=__import__("uuid").uuid4(), tenant_id=__import__("uuid").uuid4(), workspace_id=student.workspace_id, admission_number="ADM252",
        full_name="Missing Form Student",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
        dob=date(2005, 1, 3),
        segment_id=student.segment_id,
        phone_number="9876543210",
        phone_last4="3210",
        is_active=True,
    )
    db_session.add_all([st251, st252])
    db_session.add(
        PreferenceProfile(tenant_id=__import__("uuid").uuid4(), workspace_id=student.workspace_id, student_id=student.id, has_preferences=1, is_active=True)
    )
    db_session.add(
        FormResponse(
            student_id=st251.id,
            tenant_id=__import__("uuid").uuid4(),
            workspace_id=student.workspace_id,
            submitted_admission_number="ADM251",
            submitted_phone_last4="3210",
            submitted_at=datetime.now(timezone.utc),
            validation_status="invalid",
            invalid_reason="invalid_form_option",
        )
    )
    db_session.commit()

    from app.auth.dependencies import require_workspace_access
    from app.auth.contracts import AuthenticatedUser
    from app.models.tenant import Tenant
    from app.models.workspace import Workspace

    tenant = db_session.query(Tenant).filter_by(id=student.tenant_id).first()
    if not tenant:
        tenant = Tenant(id=student.tenant_id, slug="t2", display_name="T2")
        db_session.add(tenant)
    workspace = db_session.query(Workspace).filter_by(id=student.workspace_id).first()
    if not workspace:
        workspace = Workspace(id=student.workspace_id, tenant_id=tenant.id, name="W2")
        db_session.add(workspace)
    db_session.commit()
    
    user = AuthenticatedUser(
        auth_kind="app_jwt",
        tenant_id=tenant.id,
        supabase_user_id="user1",
        email="user@example.com",
        role="admin"
    )

    from app.main import app
    app.dependency_overrides[require_workspace_access] = lambda: (user, tenant, workspace)
    try:
        response = client.get(f"/api/workspaces/{student.workspace_id}/collection/non-submitters")
        assert response.status_code == 200

        payload = response.json()
        ids = [row["admission_number"] for row in payload["non_submitters"]]
    finally:
        app.dependency_overrides.clear()
    assert payload["total_count"] == 2
    assert ids == ["ADM251", "ADM252"]
