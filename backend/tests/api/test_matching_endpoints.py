from __future__ import annotations

import json
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.matching_run import MatchingRun
from app.models.pair_score import PairScore
from app.models.preference_profile import PreferenceProfile
from app.models.room import Room
from app.models.room_assignment import RoomAssignment
from app.models.segment import Segment
from app.models.student import Student


def _seed_ready_segment_with_profiles(db_session: Session, tenant_id, workspace_id, segment_key: str = "M_1st_year_AC_2") -> None:
    segment = Segment(
        tenant_id=tenant_id, 
        workspace_id=workspace_id, 
        segment_key=segment_key,
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
    )
    db_session.add(segment)
    db_session.flush()
    s1 = Student(tenant_id=tenant_id, workspace_id=workspace_id, admission_number="MR001",
        full_name="Run Student 1",
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
    s2 = Student(tenant_id=tenant_id, workspace_id=workspace_id, admission_number="MR002",
        full_name="Run Student 2",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
        dob=date(2005, 1, 2),
        segment_id=segment.id,
        phone_number="9876543210",
        phone_last4="3210",
        is_active=True,
    )
    db_session.add_all([s1, s2])
    db_session.flush()
    db_session.add_all(
        [
            PreferenceProfile(tenant_id=tenant_id, workspace_id=workspace_id, student_id=s1.id,
                has_preferences=1,
                is_active=True,
                q1_enc=1.0,
                q2_enc=1.0,
                q3_enc=1.0,
                q4a_enc=0.0,
                q4b_enc=3.0,
                q5a_enc=0.0,
                q5b_enc=3.0,
                q6_enc=1.0,
                q7_enc=1.0,
                q8_enc=1.0,
                q9_enc=1.0,
                q10_enc=0.0,
            ),
            PreferenceProfile(tenant_id=tenant_id, workspace_id=workspace_id, student_id=s2.id,
                has_preferences=1,
                is_active=True,
                q1_enc=1.0,
                q2_enc=1.0,
                q3_enc=1.0,
                q4a_enc=0.0,
                q4b_enc=3.0,
                q5a_enc=0.0,
                q5b_enc=3.0,
                q6_enc=1.0,
                q7_enc=1.0,
                q8_enc=1.0,
                q9_enc=1.0,
                q10_enc=0.0,
            ),
        ]
    )
    db_session.add(
        Room(tenant_id=tenant_id, workspace_id=workspace_id, room_id="A-101",
            segment_id=segment.id,
            capacity=2,
            source="uploaded",
            is_active=True,
        )
    )
    db_session.commit()


def test_matching_run_persists_artifacts_and_fairness_snapshot(
    client: TestClient,
    db_session: Session,
    seed_tenant_and_user,
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    auth_headers = seed_tenant_and_user["headers"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    
    _seed_ready_segment_with_profiles(db_session, tenant_id, workspace_id)

    response = client.post(
        f"/api/workspaces/{workspace_id}/matching/runs",
        json={"scope": "segment", "segment_key": "M_1st_year_AC_2"},
        headers=auth_headers
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "completed"
    run_id = payload["run_id"]

    run_row = db_session.scalars(select(MatchingRun).where(MatchingRun.run_id == run_id)).first()
    assert run_row is not None
    assert run_row.fairness_summary_json is not None

    pair_rows = db_session.scalars(
        select(PairScore).where(PairScore.matching_run_id == run_row.id)
    ).all()
    assert len(pair_rows) == 1

    assignment_rows = db_session.scalars(
        select(RoomAssignment).where(RoomAssignment.matching_run_id == run_row.id)
    ).all()
    assert len(assignment_rows) == 1
    assert assignment_rows[0].satisfaction_summary_json is not None

    summary = json.loads(assignment_rows[0].satisfaction_summary_json or "{}")
    students = summary.get("students", [])
    assert len(students) == 2
    assert all(len(student["reasons"]) >= 1 for student in students)


def test_matching_runs_endpoint_reads_persisted_run_rows(
    client: TestClient,
    db_session: Session,
    seed_tenant_and_user,
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    auth_headers = seed_tenant_and_user["headers"]
    workspace_id = seed_tenant_and_user["workspace_id"]

    _seed_ready_segment_with_profiles(db_session, tenant_id, workspace_id)
    run_response = client.post(
        f"/api/workspaces/{workspace_id}/matching/runs",
        json={"scope": "segment", "segment_key": "M_1st_year_AC_2"},
        headers=auth_headers
    )
    assert run_response.status_code == 200
    run_id = run_response.json()["run_id"]

    response = client.get(f"/api/workspaces/{workspace_id}/matching/runs", headers=auth_headers)
    assert response.status_code == 200
    payload = response.json()
    row = next(item for item in payload["runs"] if item["run_id"] == run_id)
    assert row["status"] == "completed"
    assert row["segments_completed"] == 1


def test_matching_run_rejects_not_ready_segment(client: TestClient, db_session: Session, seed_tenant_and_user) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    auth_headers = seed_tenant_and_user["headers"]
    workspace_id = seed_tenant_and_user["workspace_id"]

    segment = Segment(tenant_id=tenant_id, workspace_id=workspace_id, segment_key="M_1st_year_AC_2",
        gender="M",
        year_group="1st_year",
        ac_type="AC",
        room_size=2,
    )
    db_session.add(segment)
    db_session.flush()
    db_session.add_all(
        [
            Student(tenant_id=tenant_id, workspace_id=workspace_id, admission_number="MR010",
                full_name="Missing Pref 1",
                gender="M",
                year_group="1st_year",
                ac_type="AC",
                room_size=2,
                dob=date(2005, 1, 1),
                segment_id=segment.id,
                phone_number="9876543210",
                phone_last4="3210",
                is_active=True,
            ),
            Student(tenant_id=tenant_id, workspace_id=workspace_id, admission_number="MR011",
                full_name="Missing Pref 2",
                gender="M",
                year_group="1st_year",
                ac_type="AC",
                room_size=2,
                dob=date(2005, 1, 2),
                segment_id=segment.id,
                phone_number="9876543210",
                phone_last4="3210",
                is_active=True,
            ),
        ]
    )
    db_session.commit()

    response = client.post(
        f"/api/workspaces/{workspace_id}/matching/runs",
        json={"scope": "segment", "segment_key": "M_1st_year_AC_2"},
        headers=auth_headers
    )
    assert response.status_code == 400
    assert "not ready" in response.json()["detail"].lower()
