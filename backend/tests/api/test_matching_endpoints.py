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


def _seed_ready_segment_with_profiles(db_session: Session, segment_key: str = "M_1st_year_AC_2") -> None:
    db_session.add(
        Segment(
            segment_key=segment_key,
            gender="M",
            year_group="1st_year",
            ac_type="AC",
            room_size=2,
        )
    )
    db_session.add_all(
        [
            Student(
                admission_number="MR001",
                full_name="Run Student 1",
                gender="M",
                year_group="1st_year",
                ac_type="AC",
                room_size=2,
                dob=date(2005, 1, 1),
                segment_key=segment_key,
            ),
            Student(
                admission_number="MR002",
                full_name="Run Student 2",
                gender="M",
                year_group="1st_year",
                ac_type="AC",
                room_size=2,
                dob=date(2005, 1, 2),
                segment_key=segment_key,
            ),
        ]
    )
    db_session.add_all(
        [
            PreferenceProfile(
                admission_number="MR001",
                has_preferences=1,
                is_active=1,
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
            PreferenceProfile(
                admission_number="MR002",
                has_preferences=1,
                is_active=1,
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
        Room(
            room_id="A-101",
            segment_key=segment_key,
            capacity=2,
            source="uploaded",
        )
    )
    db_session.commit()


def test_matching_run_persists_artifacts_and_fairness_snapshot(
    client: TestClient,
    db_session: Session,
) -> None:
    _seed_ready_segment_with_profiles(db_session)

    response = client.post(
        "/api/matching/run",
        json={"scope": "segment", "segment_key": "M_1st_year_AC_2"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "completed"
    run_id = payload["run_id"]

    run_row = db_session.get(MatchingRun, run_id)
    assert run_row is not None
    assert run_row.fairness_summary_json is not None

    pair_rows = db_session.scalars(
        select(PairScore).where(PairScore.run_id == run_id)
    ).all()
    assert len(pair_rows) == 1

    assignment_rows = db_session.scalars(
        select(RoomAssignment).where(RoomAssignment.run_id == run_id)
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
) -> None:
    _seed_ready_segment_with_profiles(db_session)
    run_response = client.post(
        "/api/matching/run",
        json={"scope": "segment", "segment_key": "M_1st_year_AC_2"},
    )
    assert run_response.status_code == 200
    run_id = run_response.json()["run_id"]

    response = client.get("/api/matching/runs")
    assert response.status_code == 200
    payload = response.json()
    row = next(item for item in payload["runs"] if item["run_id"] == run_id)
    assert row["status"] == "completed"
    assert row["segments_completed"] == 1


def test_matching_run_rejects_not_ready_segment(client: TestClient, db_session: Session) -> None:
    db_session.add(
        Segment(
            segment_key="M_1st_year_AC_2",
            gender="M",
            year_group="1st_year",
            ac_type="AC",
            room_size=2,
        )
    )
    db_session.add_all(
        [
            Student(
                admission_number="MR010",
                full_name="Missing Pref 1",
                gender="M",
                year_group="1st_year",
                ac_type="AC",
                room_size=2,
                dob=date(2005, 1, 1),
                segment_key="M_1st_year_AC_2",
            ),
            Student(
                admission_number="MR011",
                full_name="Missing Pref 2",
                gender="M",
                year_group="1st_year",
                ac_type="AC",
                room_size=2,
                dob=date(2005, 1, 2),
                segment_key="M_1st_year_AC_2",
            ),
        ]
    )
    db_session.commit()

    response = client.post(
        "/api/matching/run",
        json={"scope": "segment", "segment_key": "M_1st_year_AC_2"},
    )
    assert response.status_code == 400
    assert "not ready" in response.json()["detail"].lower()
