from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.form_response import FormResponse
from tests.api.test_matching_endpoints import _seed_ready_segment_with_profiles


def test_exports_assignments_endpoint_streams_csv(client: TestClient, db_session: Session) -> None:
    _seed_ready_segment_with_profiles(db_session)
    run_response = client.post(
        "/api/matching/run",
        json={"scope": "segment", "segment_key": "M_1st_year_AC_2"},
    )
    assert run_response.status_code == 200
    run_id = run_response.json()["run_id"]

    response = client.get(f"/api/exports/assignments/{run_id}")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]

    content = response.text
    assert "room_id,segment_key,student_1,student_2,student_3,student_4,group_score" in content
    assert "MR001" in content
    assert "MR002" in content


def test_dashboard_endpoint_returns_setup_and_latest_run_summary(
    client: TestClient,
    db_session: Session,
) -> None:
    _seed_ready_segment_with_profiles(db_session)
    db_session.add(
        FormResponse(
            student_id=__import__("uuid").uuid4(),
            tenant_id=__import__("uuid").uuid4(),
            workspace_id=__import__("uuid").uuid4(),
            submitted_admission_number="MR001",
            submitted_phone_last4="1234",
            submitted_at=datetime.now(timezone.utc),
            validation_status="valid",
            invalid_reason=None,
        )
    )
    db_session.commit()

    run_response = client.post(
        "/api/matching/run",
        json={"scope": "segment", "segment_key": "M_1st_year_AC_2"},
    )
    assert run_response.status_code == 200
    run_id = run_response.json()["run_id"]

    response = client.get("/api/dashboard")
    assert response.status_code == 200
    payload = response.json()

    assert payload["setup_status"]["master_students_uploaded"] is True
    assert payload["setup_status"]["rooms_uploaded"] is True
    assert payload["setup_status"]["forms_collection_started"] is True
    assert payload["setup_status"]["at_least_one_segment_ready"] is True

    assert payload["form_collection_stats"]["total_students"] == 2
    assert payload["form_collection_stats"]["students_with_valid_preferences"] == 2
    assert payload["form_collection_stats"]["percentage_complete"] == 100.0

    assert payload["segments_status"]["total_segments"] == 1
    assert payload["latest_matching_run"]["run_id"] == run_id
    assert payload["latest_matching_run"]["status"] == "completed"
