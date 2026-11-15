"""Dashboard summary branch coverage: ready / risk / impossible segments."""
from __future__ import annotations

import uuid
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.preference_profile import PreferenceProfile
from app.models.room import Room
from app.models.segment import Segment
from app.models.student import Student


def _add_segment(
    db_session: Session,
    *,
    tenant_id,
    workspace_id,
    segment_key: str,
    gender: str,
    year_group: str,
    ac_type: str,
    admissions: int,
    profiles: int,
    generated: bool = False,
    rooms: list[int] | None = None,
) -> Segment:
    segment = Segment(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        segment_key=segment_key,
        gender=gender,
        year_group=year_group,
        ac_type=ac_type,
        room_size=2,
    )
    db_session.add(segment)
    db_session.flush()

    students = []
    for idx in range(1, admissions + 1):
        student = Student(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            segment_id=segment.id,
            admission_number=f"{segment_key}-{idx}",
            full_name=f"Dashboard Student {segment_key} {idx}",
            gender=gender,
            year_group=year_group,
            ac_type=ac_type,
            room_size=2,
            dob=date(2005, 1, idx),
            phone_last4="3210",
            is_active=True,
        )
        students.append(student)
    db_session.add_all(students)
    db_session.flush()

    for student in students[:profiles]:
        db_session.add(
            PreferenceProfile(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                student_id=student.id,
                has_preferences=True,
                is_active=True,
                is_generated=generated,
            )
        )

    for index, capacity in enumerate(rooms or [], start=1):
        db_session.add(
            Room(
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                segment_id=segment.id,
                room_id=f"{segment_key}-R{index}",
                capacity=capacity,
                source="uploaded",
                is_active=True,
            )
        )

    db_session.commit()
    return segment


def test_dashboard_reports_ready_risk_and_impossible_segments(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    _add_segment(
        db_session,
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        segment_key="IMPOSSIBLE_F_1st_year_AC_2",
        gender="F",
        year_group="1st_year",
        ac_type="AC",
        admissions=3,
        profiles=0,
        rooms=[2],
    )
    _add_segment(
        db_session,
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        segment_key="RISK_M_1st_year_AC_2",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        admissions=2,
        profiles=0,
        rooms=[2],
    )
    _add_segment(
        db_session,
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        segment_key="READY_F_2nd_year_NonAC_2",
        gender="F",
        year_group="2nd_year",
        ac_type="NonAC",
        admissions=2,
        profiles=2,
        generated=True,
    )

    response = client.get(f"/api/workspaces/{workspace_id}/dashboard", headers=headers)
    assert response.status_code == 200, response.text
    payload = response.json()

    assert payload["segments_status"] == {
        "total_segments": 3,
        "ready": 1,
        "impossible": 1,
        "at_risk": 1,
    }
    assert payload["setup_status"] == {
        "master_students_uploaded": True,
        "rooms_uploaded": True,
        "forms_collection_started": False,
        "at_least_one_segment_ready": True,
    }
    assert payload["form_collection_stats"] == {
        "total_students": 7,
        "students_with_valid_preferences": 2,
        "percentage_complete": 28.57,
    }
    assert payload["latest_matching_run"]["run_id"] is None
    assert payload["generated_data_warning"] == {
        "has_generated_data": True,
        "generated_profiles_count": 2,
        "total_active_profiles": 2,
    }


def test_dashboard_without_generated_data_reports_zero(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    _add_segment(
        db_session,
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        segment_key="READY_F_1st_year_AC_2",
        gender="F",
        year_group="1st_year",
        ac_type="AC",
        admissions=2,
        profiles=2,
    )

    response = client.get(f"/api/workspaces/{workspace_id}/dashboard", headers=headers)
    payload = response.json()
    assert payload["generated_data_warning"]["has_generated_data"] is False
    assert payload["segments_status"]["ready"] == 1
    assert uuid.UUID(payload["workspace"]["id"]) == workspace_id
