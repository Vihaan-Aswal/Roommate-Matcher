"""Route matrix for matching / fairness / exports / checker endpoints.

Covers happy paths, invalid input, unauthenticated, wrong workspace and
not-found branches against the persisted-artifact readers.
"""
from __future__ import annotations

import json
import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models.matching_run import MatchingRun
from app.models.preference_profile import PreferenceProfile
from app.models.room import Room
from app.models.room_assignment import RoomAssignment
from app.models.segment import Segment
from app.models.student import Student
from app.models.workspace import Workspace


def _seed_segment(
    db_session: Session,
    tenant_id,
    workspace_id,
    *,
    segment_key: str,
    gender: str,
    admission_prefix: str,
    room_size: int = 2,
    with_profiles: bool = True,
) -> Segment:
    segment = Segment(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        segment_key=segment_key,
        gender=gender,
        year_group="1st_year",
        ac_type="AC",
        room_size=room_size,
    )
    db_session.add(segment)
    db_session.flush()

    students = [
        Student(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            admission_number=f"{admission_prefix}{idx:03d}",
            full_name=f"Matrix Student {admission_prefix}{idx}",
            gender=gender,
            year_group="1st_year",
            ac_type="AC",
            room_size=room_size,
            dob=date(2005, 1, idx),
            segment_id=segment.id,
            phone_number="9876543210",
            phone_last4="3210",
            is_active=True,
        )
        for idx in (1, 2)
    ]
    db_session.add_all(students)
    db_session.flush()

    if with_profiles:
        db_session.add_all(
            [
                PreferenceProfile(
                    tenant_id=tenant_id,
                    workspace_id=workspace_id,
                    student_id=student.id,
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
                )
                for student in students
            ]
        )

    db_session.add(
        Room(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            segment_id=segment.id,
            room_id=f"{admission_prefix}-ROOM",
            capacity=room_size,
            source="uploaded",
            is_active=True,
        )
    )
    db_session.commit()
    return segment


def _run_matching(
    client: TestClient, workspace_id, headers, *, segment_key: str = "F_1st_year_AC_2"
) -> str:
    response = client.post(
        f"/api/workspaces/{workspace_id}/matching/runs",
        json={"scope": "segment", "segment_key": segment_key},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()["run_id"]


def _seed_run_with_assignment(
    db_session: Session,
    tenant_id,
    workspace_id,
    segment: Segment,
    *,
    run_id: str,
    assigned_students_json: str,
    satisfaction_summary_json: str | None = None,
    group_score: float = 0.5,
) -> MatchingRun:
    run = MatchingRun(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        run_id=run_id,
        scope="segment",
        target_segment_id=segment.id,
        status="completed",
    )
    db_session.add(run)
    db_session.flush()
    db_session.add(
        RoomAssignment(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            matching_run_id=run.id,
            segment_id=segment.id,
            room_id="R-001",
            assigned_students_json=assigned_students_json,
            group_score=group_score,
            satisfaction_summary_json=satisfaction_summary_json,
        )
    )
    db_session.commit()
    return run


# ---------------------------------------------------------------------------
# Matching runs
# ---------------------------------------------------------------------------


def test_matching_run_requires_segment_key_for_segment_scope(
    client: TestClient, seed_tenant_and_user
) -> None:
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    response = client.post(
        f"/api/workspaces/{workspace_id}/matching/runs",
        json={"scope": "segment"},
        headers=headers,
    )
    assert response.status_code == 422
    assert "segment_key is required" in json.dumps(response.json())


def test_matching_run_rejects_segment_key_for_all_scope(
    client: TestClient, seed_tenant_and_user
) -> None:
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    response = client.post(
        f"/api/workspaces/{workspace_id}/matching/runs",
        json={"scope": "all_ready_segments", "segment_key": "F_1st_year_AC_2"},
        headers=headers,
    )
    assert response.status_code == 422
    assert "segment_key must be null" in json.dumps(response.json())


def test_matching_run_rejects_unknown_scope(client: TestClient, seed_tenant_and_user) -> None:
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    response = client.post(
        f"/api/workspaces/{workspace_id}/matching/runs",
        json={"scope": "everything"},
        headers=headers,
    )
    assert response.status_code == 422


def test_matching_run_unknown_segment_is_400(
    client: TestClient, seed_tenant_and_user
) -> None:
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    response = client.post(
        f"/api/workspaces/{workspace_id}/matching/runs",
        json={"scope": "segment", "segment_key": "NO_SUCH_SEGMENT"},
        headers=headers,
    )
    assert response.status_code == 400


def test_matching_run_all_ready_segments_with_no_ready_segments_is_400(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    _seed_segment(
        db_session,
        tenant_id,
        workspace_id,
        segment_key="M_1st_year_AC_2",
        gender="M",
        admission_prefix="NR",
        with_profiles=False,
    )

    response = client.post(
        f"/api/workspaces/{workspace_id}/matching/runs",
        json={"scope": "all_ready_segments"},
        headers=headers,
    )
    assert response.status_code == 400
    assert "No ready segments" in response.json()["detail"]


def test_matching_run_all_ready_segments_matches_every_ready_segment(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    _seed_segment(
        db_session,
        tenant_id,
        workspace_id,
        segment_key="F_1st_year_AC_2",
        gender="F",
        admission_prefix="AF",
    )
    _seed_segment(
        db_session,
        tenant_id,
        workspace_id,
        segment_key="M_1st_year_AC_2",
        gender="M",
        admission_prefix="AM",
    )

    response = client.post(
        f"/api/workspaces/{workspace_id}/matching/runs",
        json={"scope": "all_ready_segments"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["scope"] == "all_ready_segments"
    assert payload["segments_matched"] == 2
    assert payload["status"] == "completed"

    run_history = client.get(
        f"/api/workspaces/{workspace_id}/matching/runs", headers=headers
    )
    assert run_history.status_code == 200
    row = next(
        item for item in run_history.json()["runs"] if item["run_id"] == payload["run_id"]
    )
    assert row["segments_completed"] == 2


def test_matching_runs_requires_workspace_access(client: TestClient) -> None:
    response = client.get(f"/api/workspaces/{uuid.uuid4()}/matching/runs")
    assert response.status_code == 401


def test_matching_results_require_segment_key(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    _seed_segment(
        db_session,
        tenant_id,
        workspace_id,
        segment_key="F_1st_year_AC_2",
        gender="F",
        admission_prefix="RK",
    )
    run_id = _run_matching(client, workspace_id, headers)

    for suffix in ("rooms", "students"):
        response = client.get(
            f"/api/workspaces/{workspace_id}/matching/runs/{run_id}/{suffix}",
            headers=headers,
        )
        assert response.status_code == 422, suffix


def test_matching_results_rooms_and_students_happy_path(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    _seed_segment(
        db_session,
        tenant_id,
        workspace_id,
        segment_key="F_1st_year_AC_2",
        gender="F",
        admission_prefix="HP",
    )
    run_id = _run_matching(client, workspace_id, headers)
    query = "?segment_key=F_1st_year_AC_2"

    rooms = client.get(
        f"/api/workspaces/{workspace_id}/matching/runs/{run_id}/rooms{query}",
        headers=headers,
    )
    assert rooms.status_code == 200, rooms.text
    assert len(rooms.json()["rooms"]) == 1
    assert rooms.json()["has_generated_profiles"] is False

    students = client.get(
        f"/api/workspaces/{workspace_id}/matching/runs/{run_id}/students{query}",
        headers=headers,
    )
    assert students.status_code == 200, students.text
    assert [row["admission_number"] for row in students.json()["students"]] == ["HP001", "HP002"]

    all_segments = client.get(
        f"/api/workspaces/{workspace_id}/matching/runs/{run_id}/students/all-segments",
        headers=headers,
    )
    assert all_segments.status_code == 200, all_segments.text
    assert [row["segment_key"] for row in all_segments.json()["segments"]] == [
        "F_1st_year_AC_2"
    ]

    # A magic-filled profile flips the generated-data flag on both responses.
    # NOTE: a Core UPDATE keeps this test independent of ORM default plumbing.
    student = db_session.query(Student).filter_by(admission_number="HP001").one()
    db_session.execute(
        update(PreferenceProfile)
        .where(PreferenceProfile.student_id == student.id)
        .values(is_generated=True)
    )
    db_session.commit()

    flagged = client.get(
        f"/api/workspaces/{workspace_id}/matching/runs/{run_id}/students{query}",
        headers=headers,
    )
    assert flagged.json()["has_generated_profiles"] is True

    flagged_rooms = client.get(
        f"/api/workspaces/{workspace_id}/matching/runs/{run_id}/rooms{query}",
        headers=headers,
    )
    assert flagged_rooms.json()["has_generated_profiles"] is True


def test_matching_results_unknown_run_is_403(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    for path in (
        f"/api/workspaces/{workspace_id}/matching/runs/run_missing/rooms?segment_key=X",
        f"/api/workspaces/{workspace_id}/matching/runs/run_missing/students?segment_key=X",
        f"/api/workspaces/{workspace_id}/matching/runs/run_missing/students/all-segments",
        f"/api/workspaces/{workspace_id}/fairness/run_missing",
        f"/api/workspaces/{workspace_id}/exports/assignments/run_missing",
    ):
        response = client.get(path, headers=headers)
        assert response.status_code == 403, path
        assert response.json()["detail"] == "run_not_found_or_not_owned"


def test_matching_results_unknown_segment_is_404(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    _seed_segment(
        db_session,
        tenant_id,
        workspace_id,
        segment_key="F_1st_year_AC_2",
        gender="F",
        admission_prefix="US",
    )
    run_id = _run_matching(client, workspace_id, headers)

    for suffix in ("rooms", "students"):
        response = client.get(
            f"/api/workspaces/{workspace_id}/matching/runs/{run_id}/{suffix}?segment_key=OTHER",
            headers=headers,
        )
        assert response.status_code == 404, suffix
        assert "Matching artifacts not found" in response.json()["detail"]


def test_matching_results_corrupt_artifacts_are_500(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    segment = _seed_segment(
        db_session,
        tenant_id,
        workspace_id,
        segment_key="F_1st_year_AC_2",
        gender="F",
        admission_prefix="CR",
    )

    _seed_run_with_assignment(
        db_session,
        tenant_id,
        workspace_id,
        segment,
        run_id="run_bad_json_list",
        assigned_students_json=json.dumps({"not": "a list"}),
    )
    response = client.get(
        f"/api/workspaces/{workspace_id}/matching/runs/run_bad_json_list/rooms"
        "?segment_key=F_1st_year_AC_2",
        headers=headers,
    )
    assert response.status_code == 500
    assert "JSON list" in response.json()["detail"]

    students_response = client.get(
        f"/api/workspaces/{workspace_id}/matching/runs/run_bad_json_list/students"
        "?segment_key=F_1st_year_AC_2",
        headers=headers,
    )
    assert students_response.status_code == 500
    assert "JSON list" in students_response.json()["detail"]

    _seed_run_with_assignment(
        db_session,
        tenant_id,
        workspace_id,
        segment,
        run_id="run_bad_summary",
        assigned_students_json=json.dumps(["CR001", "CR002"]),
        satisfaction_summary_json=json.dumps(["not", "an", "object"]),
    )
    response = client.get(
        f"/api/workspaces/{workspace_id}/matching/runs/run_bad_summary/students"
        "?segment_key=F_1st_year_AC_2",
        headers=headers,
    )
    assert response.status_code == 500
    assert "JSON object" in response.json()["detail"]

    rooms_response = client.get(
        f"/api/workspaces/{workspace_id}/matching/runs/run_bad_summary/rooms"
        "?segment_key=F_1st_year_AC_2",
        headers=headers,
    )
    assert rooms_response.status_code == 500
    assert "JSON object" in rooms_response.json()["detail"]

    _seed_run_with_assignment(
        db_session,
        tenant_id,
        workspace_id,
        segment,
        run_id="run_missing_student_summary",
        assigned_students_json=json.dumps(["CR001", "CR002"]),
        satisfaction_summary_json=json.dumps({"students": [{"student_id": "CR001"}]}),
    )
    response = client.get(
        f"/api/workspaces/{workspace_id}/matching/runs/run_missing_student_summary/students"
        "?segment_key=F_1st_year_AC_2",
        headers=headers,
    )
    assert response.status_code == 500
    assert "missing a student record" in response.json()["detail"]


# ---------------------------------------------------------------------------
# Fairness
# ---------------------------------------------------------------------------


def test_fairness_report_happy_path(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    _seed_segment(
        db_session,
        tenant_id,
        workspace_id,
        segment_key="F_1st_year_AC_2",
        gender="F",
        admission_prefix="FR",
    )
    run_id = _run_matching(client, workspace_id, headers)

    response = client.get(
        f"/api/workspaces/{workspace_id}/fairness/{run_id}", headers=headers
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["run_id"] == run_id
    assert payload["total_students"] == 2
    assert payload["by_segment"][0]["segment_key"] == "F_1st_year_AC_2"
    assert payload["has_generated_profiles"] is False


def test_fairness_report_missing_snapshot_is_404(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    segment = _seed_segment(
        db_session,
        tenant_id,
        workspace_id,
        segment_key="F_1st_year_AC_2",
        gender="F",
        admission_prefix="FN",
    )
    db_session.add(
        MatchingRun(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            run_id="run_no_fairness",
            scope="segment",
            target_segment_id=segment.id,
            status="completed",
        )
    )
    db_session.commit()

    response = client.get(
        f"/api/workspaces/{workspace_id}/fairness/run_no_fairness", headers=headers
    )
    assert response.status_code == 404
    assert "Fairness snapshot not found" in response.json()["detail"]


def test_fairness_report_non_object_snapshot_is_500(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    segment = _seed_segment(
        db_session,
        tenant_id,
        workspace_id,
        segment_key="F_1st_year_AC_2",
        gender="F",
        admission_prefix="FJ",
    )
    db_session.add(
        MatchingRun(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            run_id="run_fairness_string",
            scope="segment",
            target_segment_id=segment.id,
            status="completed",
            fairness_summary_json=json.dumps("not-an-object"),
        )
    )
    db_session.commit()

    response = client.get(
        f"/api/workspaces/{workspace_id}/fairness/run_fairness_string", headers=headers
    )
    assert response.status_code == 500
    assert "JSON object" in response.json()["detail"]


# ---------------------------------------------------------------------------
# Exports
# ---------------------------------------------------------------------------


def test_export_assignments_happy_path_and_segment_filter(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    _seed_segment(
        db_session,
        tenant_id,
        workspace_id,
        segment_key="F_1st_year_AC_2",
        gender="F",
        admission_prefix="EX",
    )
    run_id = _run_matching(client, workspace_id, headers)

    response = client.get(
        f"/api/workspaces/{workspace_id}/exports/assignments/{run_id}", headers=headers
    )
    assert response.status_code == 200
    assert response.headers["content-disposition"] == (
        f'attachment; filename="assignments_{run_id}.csv"'
    )
    lines = response.text.strip().splitlines()
    assert lines[0] == "room_id,segment_key,student_1,student_2,student_3,student_4,group_score"
    assert lines[1].startswith("EX-ROOM,F_1st_year_AC_2,")

    filtered = client.get(
        f"/api/workspaces/{workspace_id}/exports/assignments/{run_id}"
        "?segment_key=F_1st_year_AC_2",
        headers=headers,
    )
    assert filtered.status_code == 200
    assert response.text == filtered.text

    unmatched = client.get(
        f"/api/workspaces/{workspace_id}/exports/assignments/{run_id}"
        "?segment_key=M_1st_year_AC_2",
        headers=headers,
    )
    assert unmatched.status_code == 404
    assert "No assignment artifacts" in unmatched.json()["detail"]


def test_export_assignments_without_artifacts_is_404(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    segment = _seed_segment(
        db_session,
        tenant_id,
        workspace_id,
        segment_key="F_1st_year_AC_2",
        gender="F",
        admission_prefix="EA",
    )
    db_session.add(
        MatchingRun(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            run_id="run_empty_export",
            scope="segment",
            target_segment_id=segment.id,
            status="completed",
        )
    )
    db_session.commit()

    response = client.get(
        f"/api/workspaces/{workspace_id}/exports/assignments/run_empty_export",
        headers=headers,
    )
    assert response.status_code == 404
    assert "No assignment artifacts" in response.json()["detail"]


def test_export_skips_assignments_whose_students_json_is_not_a_list(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    segment = _seed_segment(
        db_session,
        tenant_id,
        workspace_id,
        segment_key="F_1st_year_AC_2",
        gender="F",
        admission_prefix="ES",
    )
    _seed_run_with_assignment(
        db_session,
        tenant_id,
        workspace_id,
        segment,
        run_id="run_export_object",
        assigned_students_json=json.dumps({"students": ["ES001"]}),
    )

    response = client.get(
        f"/api/workspaces/{workspace_id}/exports/assignments/run_export_object",
        headers=headers,
    )
    assert response.status_code == 200
    lines = response.text.strip().splitlines()
    assert lines == [
        "room_id,segment_key,student_1,student_2,student_3,student_4,group_score"
    ]


# ---------------------------------------------------------------------------
# Checker
# ---------------------------------------------------------------------------


def test_checker_unknown_students_is_404(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    _seed_segment(
        db_session,
        tenant_id,
        workspace_id,
        segment_key="F_1st_year_AC_2",
        gender="F",
        admission_prefix="CK",
    )

    response = client.post(
        f"/api/workspaces/{workspace_id}/checker/compatibility",
        json={
            "segment_key": "F_1st_year_AC_2",
            "room_size": 2,
            "student_ids": ["CK001", "GHOST999"],
        },
        headers=headers,
    )
    assert response.status_code == 404
    assert "students not found" in response.json()["detail"]


def test_checker_rejects_empty_student_ids(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    empty = client.post(
        f"/api/workspaces/{workspace_id}/checker/compatibility",
        json={"segment_key": "F_1st_year_AC_2", "room_size": 2, "student_ids": []},
        headers=headers,
    )
    assert empty.status_code == 400
    assert empty.json()["detail"] == "student_ids must not be empty"


def test_checker_service_rejects_duplicate_student_ids(
    db_session: Session, seed_tenant_and_user
) -> None:
    from app.services.orchestration.checker_workflow import run_manual_checker

    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    _seed_segment(
        db_session,
        tenant_id,
        workspace_id,
        segment_key="F_1st_year_AC_2",
        gender="F",
        admission_prefix="DQ",
    )

    with pytest.raises(ValueError, match="student_ids must be unique"):
        run_manual_checker(
            db_session,
            segment_key="F_1st_year_AC_2",
            workspace_id=workspace_id,
            room_size=2,
            student_ids=["DQ001", "DQ001"],
        )


def test_checker_unknown_segment_is_400(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    segment = _seed_segment(
        db_session,
        tenant_id,
        workspace_id,
        segment_key="F_1st_year_AC_2",
        gender="F",
        admission_prefix="CM",
    )
    db_session.commit()

    # Students exist in the workspace but the requested segment does not.
    response = client.post(
        f"/api/workspaces/{workspace_id}/checker/compatibility",
        json={
            "segment_key": "MISSING_SEGMENT",
            "room_size": 2,
            "student_ids": ["CM001", "CM002"],
        },
        headers=headers,
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Segment not found"
    assert segment.id is not None


def test_checker_ignores_client_supplied_scores_and_labels(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    _seed_segment(
        db_session,
        tenant_id,
        workspace_id,
        segment_key="F_1st_year_AC_2",
        gender="F",
        admission_prefix="CP",
    )

    response = client.post(
        f"/api/workspaces/{workspace_id}/checker/compatibility",
        json={
            "segment_key": "F_1st_year_AC_2",
            "room_size": 2,
            "student_ids": ["CP001", "CP002"],
            "precomputed_satisfaction": {"CP001": 0.4, "CP002": 0.4},
            "precomputed_labels": {"CP001": "Poor", "CP002": "Poor"},
        },
        headers=headers,
    )
    assert response.status_code == 200, response.text
    payload = response.json()

    # The seeded profiles are identical, so the real pair score is 1.0. The
    # client-supplied 0.4 / "Poor" values must be ignored.
    assert payload["at_risk_students"] == []
    by_student = {row["admission_number"]: row for row in payload["students"]}
    assert by_student["CP001"]["satisfaction_score"] == 1.0
    assert by_student["CP002"]["satisfaction_score"] == 1.0
    assert by_student["CP001"]["satisfaction_label"] == "Excellent"
    assert by_student["CP002"]["satisfaction_label"] == "Excellent"


def test_checker_client_scores_cannot_force_excellent_for_a_mismatched_pair(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    _seed_segment(
        db_session,
        tenant_id,
        workspace_id,
        segment_key="F_1st_year_AC_2",
        gender="F",
        admission_prefix="CX",
    )

    second_student = (
        db_session.query(Student).filter_by(admission_number="CX002").one()
    )
    db_session.execute(
        update(PreferenceProfile)
        .where(PreferenceProfile.student_id == second_student.id)
        .values(
            q1_enc=4.0,
            q2_enc=3.0,
            q3_enc=3.0,
            q4a_enc=2.0,
            q4b_enc=0.0,
            q5a_enc=2.0,
            q5b_enc=0.0,
            q6_enc=3.0,
            q7_enc=3.0,
            q8_enc=3.0,
            q9_enc=3.0,
            q10_enc=3.0,
        )
    )
    db_session.commit()

    response = client.post(
        f"/api/workspaces/{workspace_id}/checker/compatibility",
        json={
            "segment_key": "F_1st_year_AC_2",
            "room_size": 2,
            "student_ids": ["CX001", "CX002"],
            "precomputed_satisfaction": {"CX001": 0.95, "CX002": 0.95},
            "precomputed_labels": {"CX001": "Excellent", "CX002": "Excellent"},
        },
        headers=headers,
    )
    assert response.status_code == 200, response.text
    payload = response.json()

    labels = [row["satisfaction_label"] for row in payload["students"]]
    assert "Excellent" not in labels, labels
    assert payload["group_label"] != "Excellent"
    assert payload["at_risk_students"] == ["CX001", "CX002"]



def test_results_routes_scope_to_the_requested_workspace(
    client: TestClient, db_session: Session, seed_tenant_and_user
) -> None:
    tenant_id = seed_tenant_and_user["tenant_id"]
    workspace_id = seed_tenant_and_user["workspace_id"]
    headers = seed_tenant_and_user["headers"]

    other_workspace = Workspace(
        tenant_id=tenant_id, name="Other WS", status="draft", source="manual"
    )
    db_session.add(other_workspace)
    db_session.commit()

    response = client.get(
        f"/api/workspaces/{other_workspace.id}/fairness/run_any", headers=headers
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "run_not_found_or_not_owned"
