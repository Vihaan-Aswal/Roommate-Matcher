from __future__ import annotations

import json

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.matching_run import MatchingRun
from app.models.room_assignment import RoomAssignment
from tests.api.test_matching_endpoints import _seed_ready_segment_with_profiles


def test_matching_result_endpoints_return_persisted_room_and_student_views(
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

    rooms_response = client.get(f"/api/matching/runs/{run_id}/segments/M_1st_year_AC_2/rooms")
    assert rooms_response.status_code == 200
    rooms_payload = rooms_response.json()
    assert len(rooms_payload["rooms"]) == 1
    assert len(rooms_payload["rooms"][0]["assigned_students"]) == 2

    students_response = client.get(f"/api/matching/runs/{run_id}/segments/M_1st_year_AC_2/students")
    assert students_response.status_code == 200
    students_payload = students_response.json()
    assert len(students_payload["students"]) == 2
    assert all(len(item["reasons"]) >= 1 for item in students_payload["students"])


def test_fairness_endpoint_reads_snapshot_stored_on_run_row(
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

    run_row = db_session.get(MatchingRun, run_id)
    assert run_row is not None
    run_row.fairness_summary_json = json.dumps(
        {
            "total_students": 2,
            "run_label_counts": {"Excellent": 0, "Good": 2, "Okay": 0, "Poor": 0},
            "run_label_percentages": {"Excellent": 0.0, "Good": 1.0, "Okay": 0.0, "Poor": 0.0},
            "run_at_risk_count": 0,
            "run_at_risk_student_ids": [],
            "by_segment": [
                {
                    "segment_key": "M_1st_year_AC_2",
                    "total_students": 2,
                    "label_counts": {"Excellent": 0, "Good": 2, "Okay": 0, "Poor": 0},
                    "label_percentages": {"Excellent": 0.0, "Good": 1.0, "Okay": 0.0, "Poor": 0.0},
                    "at_risk_count": 0,
                    "at_risk_student_ids": [],
                    "minimum_satisfaction": 0.75,
                }
            ],
        },
        sort_keys=True,
    )
    db_session.commit()

    fairness_response = client.get(f"/api/fairness/{run_id}")
    assert fairness_response.status_code == 200
    fairness_payload = fairness_response.json()
    assert fairness_payload["run_label_counts"]["Good"] == 2
    assert fairness_payload["total_students"] == 2


def test_student_results_endpoint_reads_persisted_explanation_payload_directly(
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

    assignment = db_session.scalars(
        select(RoomAssignment).where(RoomAssignment.run_id == run_id)
    ).first()
    assert assignment is not None

    summary = json.loads(assignment.satisfaction_summary_json or "{}")
    assert "students" in summary and summary["students"]
    summary["students"][0]["reasons"] = ["Persisted explanation marker"]
    assignment.satisfaction_summary_json = json.dumps(summary, sort_keys=True)
    db_session.commit()

    students_response = client.get(f"/api/matching/runs/{run_id}/segments/M_1st_year_AC_2/students")
    assert students_response.status_code == 200
    reasons = [row["reasons"] for row in students_response.json()["students"]]
    assert ["Persisted explanation marker"] in reasons


def test_matching_results_endpoints_return_404_for_unknown_run(client: TestClient) -> None:
    rooms_response = client.get("/api/matching/runs/unknown/segments/M_1st_year_AC_2/rooms")
    assert rooms_response.status_code == 404

    students_response = client.get("/api/matching/runs/unknown/segments/M_1st_year_AC_2/students")
    assert students_response.status_code == 404
