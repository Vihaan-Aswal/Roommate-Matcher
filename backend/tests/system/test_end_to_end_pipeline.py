"""System test: one seeded pipeline over the real FastAPI app.

Every step below goes through an HTTP endpoint (TestClient, in-memory SQLite,
no network, no uvicorn). Only fixtures seed the tenant/workspace scaffolding;
all product data is created by the ingestion, public-form and matching routes.

Flow: students CSV -> rooms CSV -> segments -> public form token -> form
submissions -> matching run -> room results -> student results -> fairness ->
assignments export -> manual checker. Failure paths: capacity shortfall, zero
rooms, zero students, duplicate admission numbers, bad DOB, unusable form token.
"""
from __future__ import annotations

import csv
import io
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.student import Student

STUDENT_HEADER = "admission_number,full_name,gender,year_group,ac_type,room_size,dob,phone_number"
ROOM_HEADER = "room_id,segment_key,capacity"

SEGMENT_KEY = "M_1st_year_AC_2"

# Two well-separated answer profiles so the matcher has real signal to work with.
ANSWERS_EARLY = {
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
}

ANSWERS_LATE = {
    "q1_raw": "After 3 AM (very late)",
    "q2_raw": "Relaxed - I clean when it looks messy",
    "q3_raw": "Often after midnight",
    "q4a_raw": "Often a hangout place, friends visit frequently",
    "q4b_raw": "Fine even if it's frequent",
    "q5a_raw": "Frequently (most nights)",
    "q5b_raw": "Fine even if frequent",
    "q6_raw": "I am a smoker",
    "q7_raw": "I may store or drink (where allowed)",
    "q8_raw": "I am non-vegetarian",
    "q9_raw": "Flexible - willing to spend more for extra comfort",
    "q10_raw": "I'm very flexible/open",
}


# ---------------------------------------------------------------------------
# CSV + request helpers
# ---------------------------------------------------------------------------

def student_csv(rows: list[dict[str, str]]) -> bytes:
    lines = [STUDENT_HEADER]
    for row in rows:
        lines.append(
            ",".join(
                [
                    row["admission_number"],
                    row["full_name"],
                    row.get("gender", "M"),
                    row.get("year_group", "1st_year"),
                    row.get("ac_type", "AC"),
                    row.get("room_size", "2"),
                    row.get("dob", "2005-01-02"),
                    row["phone"],
                ]
            )
        )
    return ("\n".join(lines) + "\n").encode("utf-8")


def room_csv(rows: list[dict[str, str]]) -> bytes:
    lines = [ROOM_HEADER]
    for row in rows:
        lines.append(f"{row['room_id']},{row['segment_key']},{row['capacity']}")
    return ("\n".join(lines) + "\n").encode("utf-8")


def cohort(prefix: str, count: int) -> list[dict[str, str]]:
    """Deterministic students: phones are unique per admission number."""
    return [
        {
            "admission_number": f"{prefix}{index:03d}",
            "full_name": f"{prefix} Student {index:03d}",
            "phone": f"90000{index:05d}",
        }
        for index in range(1, count + 1)
    ]


def cohort_rooms(prefix: str, count: int) -> list[dict[str, str]]:
    return [
        {"room_id": f"{prefix}-R{index}", "segment_key": SEGMENT_KEY, "capacity": "2"}
        for index in range(1, count + 1)
    ]


def upload(client: TestClient, headers: dict[str, str], workspace_id: str, kind: str, payload: bytes) -> dict[str, Any]:
    response = client.post(
        f"/api/workspaces/{workspace_id}/{kind}/upload/apply",
        files={"file": (f"{kind}.csv", payload, "text/csv")},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()


def create_workspace(client: TestClient, headers: dict[str, str], name: str) -> str:
    response = client.post("/api/workspaces", json={"name": name}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def form_token(client: TestClient, headers: dict[str, str], workspace_id: str) -> str:
    response = client.get(f"/api/workspaces/{workspace_id}/form-link", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["token"]


def submit(
    client: TestClient, token: str, admission_number: str, phone: str, answers: dict[str, str]
) -> dict[str, Any]:
    response = client.post(
        f"/api/public/forms/{token}/submit",
        json={
            "submitted_admission_number": admission_number,
            "submitted_phone_last4": phone[-4:],
            "answers": answers,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def run_matching(client: TestClient, headers: dict[str, str], workspace_id: str) -> dict[str, Any]:
    response = client.post(
        f"/api/workspaces/{workspace_id}/matching/runs",
        json={"scope": "segment", "segment_key": SEGMENT_KEY},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()


def room_results(client: TestClient, headers: dict[str, str], workspace_id: str, run_id: str) -> list[dict[str, Any]]:
    response = client.get(
        f"/api/workspaces/{workspace_id}/matching/runs/{run_id}/rooms",
        params={"segment_key": SEGMENT_KEY},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()["rooms"]


def student_results(client: TestClient, headers: dict[str, str], workspace_id: str, run_id: str) -> list[dict[str, Any]]:
    response = client.get(
        f"/api/workspaces/{workspace_id}/matching/runs/{run_id}/students",
        params={"segment_key": SEGMENT_KEY},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()["students"]


def seed_pipeline(
    client: TestClient,
    headers: dict[str, str],
    prefix: str,
    *,
    student_count: int = 6,
    room_count: int = 3,
) -> dict[str, Any]:
    """Run the ingestion + form steps; returns the ids the later steps need."""
    workspace_id = create_workspace(client, headers, f"Pipeline {prefix}")
    students = cohort(prefix, student_count)

    student_apply = upload(client, headers, workspace_id, "students", student_csv(students))
    assert student_apply["inserted"] == student_count, student_apply
    assert student_apply["segments_created"] == 1, student_apply

    room_apply = upload(client, headers, workspace_id, "rooms", room_csv(cohort_rooms(prefix, room_count)))
    assert room_apply["inserted"] == room_count, room_apply

    token = form_token(client, headers, workspace_id)
    for index, student in enumerate(students, start=1):
        answers = ANSWERS_EARLY if index <= student_count / 2 else ANSWERS_LATE
        assert submit(client, token, student["admission_number"], student["phone"], answers)["valid"] is True

    return {
        "workspace_id": workspace_id,
        "segment_key": SEGMENT_KEY,
        "students": students,
        "token": token,
        "room_count": room_count,
    }


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

def test_seeded_pipeline_from_csv_upload_to_manual_checker(
    client: TestClient, db_session: Session, seed_tenant_and_user: dict[str, Any]
) -> None:
    headers = seed_tenant_and_user["headers"]

    # 1. Students + rooms CSV upload -> one derived segment.
    seeded = seed_pipeline(client, headers, "E2E")
    workspace_id = seeded["workspace_id"]

    segments = client.get(f"/api/workspaces/{workspace_id}/segments", headers=headers)
    assert segments.status_code == 200, segments.text
    assert segments.json()["segments"] == [
        {
            "segment_key": SEGMENT_KEY,
            "gender": "M",
            "year_group": "1st_year",
            "ac_type": "AC",
            "room_size": 2,
            "status": "Ready",
            "student_count": 6,
            "total_capacity": 6,
            "missing_preferences_count": 0,
            "missing_preferences_ratio": 0.0,
        }
    ]

    # 2. Form collection is complete (the submits happened in seed_pipeline).
    collection = client.get(f"/api/workspaces/{workspace_id}/collection/status", headers=headers)
    assert collection.status_code == 200, collection.text
    assert collection.json()["total_students"] == 6
    assert collection.json()["valid_responses"] == 6
    assert collection.json()["invalid_responses"] == 0
    assert collection.json()["percentage_valid"] == 100.0

    # 3. Matching run over the segment.
    run = run_matching(client, headers, workspace_id)
    assert run["status"] == "completed"
    assert run["scope"] == "segment"
    assert run["segments_matched"] == 1
    run_id = run["run_id"]

    history = client.get(f"/api/workspaces/{workspace_id}/matching/runs", headers=headers)
    assert history.status_code == 200, history.text
    history_row = next(row for row in history.json()["runs"] if row["run_id"] == run_id)
    assert history_row["status"] == "completed"
    assert history_row["segments_completed"] == 1

    # 4. Room results: deterministic room ordering, gender/segment/capacity respected.
    rooms = room_results(client, headers, workspace_id, run_id)
    assert [room["room_id"] for room in rooms] == ["E2E-R1", "E2E-R2", "E2E-R3"]
    for room in rooms:
        assert room["room_size"] == 2
        assert len(room["assigned_students"]) == 2
        assert 0.0 <= room["group_score"] <= 1.0
        admission_numbers = [row["admission_number"] for row in room["assigned_students"]]
        assert admission_numbers == sorted(admission_numbers)
        for row in room["assigned_students"]:
            assert set(row["pair_scores_with_roommates"]) == set(admission_numbers) - {row["admission_number"]}

    assigned_rooms = [row["admission_number"] for room in rooms for row in room["assigned_students"]]
    assert sorted(assigned_rooms) == [student["admission_number"] for student in seeded["students"]]

    # 5. Student results: one row per student, every row points back at its room.
    students = student_results(client, headers, workspace_id, run_id)
    assert [row["admission_number"] for row in students] == sorted(assigned_rooms)
    for row in students:
        assert row["satisfaction_label"] in {"Excellent", "Good", "Okay", "Poor"}
        assert 0.0 <= row["satisfaction_score"] <= 1.0
        assert len(row["roommate_ids"]) == 1
        assert row["reasons"]
        assert row["room_id"] in {room["room_id"] for room in rooms}

    # 6. Fairness snapshot is persisted on the run and agrees with the student rows.
    fairness = client.get(f"/api/workspaces/{workspace_id}/fairness/{run_id}", headers=headers)
    assert fairness.status_code == 200, fairness.text
    fairness_payload = fairness.json()
    assert fairness_payload["total_students"] == 6
    assert sum(fairness_payload["run_label_counts"].values()) == 6
    assert fairness_payload["run_at_risk_count"] == len(fairness_payload["run_at_risk_student_ids"])
    assert fairness_payload["run_at_risk_student_ids"] == sorted(
        row["admission_number"] for row in students if row["is_at_risk"]
    )
    assert [row["segment_key"] for row in fairness_payload["by_segment"]] == [SEGMENT_KEY]
    assert fairness_payload["by_segment"][0]["total_students"] == 6
    assert fairness_payload["has_generated_profiles"] is False

    # 7. Assignments export: fixed column contract, one row per room.
    export = client.get(f"/api/workspaces/{workspace_id}/exports/assignments/{run_id}", headers=headers)
    assert export.status_code == 200, export.text
    assert export.headers["content-type"].startswith("text/csv")
    assert f"assignments_{run_id}.csv" in export.headers["content-disposition"]
    export_rows = list(csv.reader(io.StringIO(export.text)))
    assert export_rows[0] == [
        "room_id",
        "segment_key",
        "student_1",
        "student_2",
        "student_3",
        "student_4",
        "group_score",
    ]
    assert len(export_rows) == 1 + len(rooms)
    exported_rooms = {row[0]: row for row in export_rows[1:]}
    for room in rooms:
        row = exported_rooms[room["room_id"]]
        assert row[1] == SEGMENT_KEY
        assert [value for value in row[2:4] if value] == [
            item["admission_number"] for item in room["assigned_students"]
        ]
        assert float(row[6]) == pytest.approx(room["group_score"], abs=1e-4)

    # 8. Manual checker reproduces the assigned room's score from the same profiles.
    first_room = rooms[0]
    checker = client.post(
        f"/api/workspaces/{workspace_id}/checker/compatibility",
        json={
            "segment_key": SEGMENT_KEY,
            "room_size": 2,
            "student_ids": [row["admission_number"] for row in first_room["assigned_students"]],
        },
        headers=headers,
    )
    assert checker.status_code == 200, checker.text
    checker_payload = checker.json()
    assert checker_payload["group_score"] == pytest.approx(first_room["group_score"], abs=1e-9)
    assert checker_payload["group_label"] in {"Excellent", "Good", "Okay", "Poor"}
    assert [row["admission_number"] for row in checker_payload["students"]] == sorted(
        row["admission_number"] for row in first_room["assigned_students"]
    )


def test_remainder_room_is_persisted_without_failing_the_run(
    client: TestClient, db_session: Session, seed_tenant_and_user: dict[str, Any]
) -> None:
    """A 3-student 2-bed segment leaves one student; the run must still complete."""
    headers = seed_tenant_and_user["headers"]
    workspace_id = create_workspace(client, headers, "Remainder workspace")

    upload(client, headers, workspace_id, "students", student_csv(cohort("REM", 3)))
    upload(client, headers, workspace_id, "rooms", room_csv(cohort_rooms("REM", 2)))

    token = form_token(client, headers, workspace_id)
    for index, phone in enumerate([f"90000{index:05d}" for index in range(1, 4)], start=1):
        assert submit(client, token, f"REM{index:03d}", phone, ANSWERS_EARLY)["valid"] is True

    run = run_matching(client, headers, workspace_id)
    assert run["status"] == "completed"
    run_id = run["run_id"]

    rooms = room_results(client, headers, workspace_id, run_id)
    sizes = sorted(len(room["assigned_students"]) for room in rooms)
    assert sizes == [1, 2]

    students = client.get(
        f"/api/workspaces/{workspace_id}/matching/runs/{run_id}/students",
        params={"segment_key": SEGMENT_KEY},
        headers=headers,
    )
    assert students.status_code == 200, students.text
    assert len(students.json()["students"]) == 3
    assert all(row["reasons"] for row in students.json()["students"])


def test_identical_inputs_produce_identical_plans(
    client: TestClient, db_session: Session, seed_tenant_and_user: dict[str, Any]
) -> None:
    headers = seed_tenant_and_user["headers"]

    first = seed_pipeline(client, headers, "E2E")
    second = seed_pipeline(client, headers, "E2E")
    assert first["workspace_id"] != second["workspace_id"]

    first_run = run_matching(client, headers, first["workspace_id"])["run_id"]
    second_run = run_matching(client, headers, second["workspace_id"])["run_id"]

    first_rooms = room_results(client, headers, first["workspace_id"], first_run)
    second_rooms = room_results(client, headers, second["workspace_id"], second_run)
    assert [
        (
            room["room_id"],
            [row["admission_number"] for row in room["assigned_students"]],
            round(room["group_score"], 12),
            room["needs_review"],
        )
        for room in first_rooms
    ] == [
        (
            room["room_id"],
            [row["admission_number"] for row in room["assigned_students"]],
            round(room["group_score"], 12),
            room["needs_review"],
        )
        for room in second_rooms
    ]

    first_students = student_results(client, headers, first["workspace_id"], first_run)
    second_students = student_results(client, headers, second["workspace_id"], second_run)
    assert [
        (
            row["admission_number"],
            row["room_id"],
            row["roommate_ids"],
            round(row["satisfaction_score"], 12),
            row["satisfaction_label"],
            row["is_at_risk"],
        )
        for row in first_students
    ] == [
        (
            row["admission_number"],
            row["room_id"],
            row["roommate_ids"],
            round(row["satisfaction_score"], 12),
            row["satisfaction_label"],
            row["is_at_risk"],
        )
        for row in second_students
    ]


# ---------------------------------------------------------------------------
# Failure paths
# ---------------------------------------------------------------------------

def test_capacity_shortfall_makes_segment_impossible_and_run_rejected(
    client: TestClient, db_session: Session, seed_tenant_and_user: dict[str, Any]
) -> None:
    headers = seed_tenant_and_user["headers"]
    workspace_id = create_workspace(client, headers, "Capacity shortfall")

    upload(client, headers, workspace_id, "students", student_csv(cohort("E2E", 4)))
    room_apply = upload(client, headers, workspace_id, "rooms", room_csv(cohort_rooms("E2E", 1)))
    assert room_apply["inserted"] == 1

    token = form_token(client, headers, workspace_id)
    for student in cohort("E2E", 4):
        submit(client, token, student["admission_number"], student["phone"], ANSWERS_EARLY)

    segment = client.get(f"/api/workspaces/{workspace_id}/segments", headers=headers).json()["segments"][0]
    assert segment["status"] == "Impossible"
    assert segment["student_count"] == 4
    assert segment["total_capacity"] == 2

    run = client.post(
        f"/api/workspaces/{workspace_id}/matching/runs",
        json={"scope": "segment", "segment_key": SEGMENT_KEY},
        headers=headers,
    )
    assert run.status_code == 400, run.text
    assert "not ready" in run.json()["detail"].lower()

    history = client.get(f"/api/workspaces/{workspace_id}/matching/runs", headers=headers).json()
    assert history["runs"] == []


def test_zero_room_rows_upload_is_rejected_and_capacity_is_auto_generated(
    client: TestClient, db_session: Session, seed_tenant_and_user: dict[str, Any]
) -> None:
    headers = seed_tenant_and_user["headers"]
    workspace_id = create_workspace(client, headers, "Zero rooms")

    upload(client, headers, workspace_id, "students", student_csv(cohort("E2E", 4)))
    empty_rooms = client.post(
        f"/api/workspaces/{workspace_id}/rooms/upload/apply",
        files={"file": ("rooms.csv", room_csv([]), "text/csv")},
        headers=headers,
    )
    assert empty_rooms.status_code == 400, empty_rooms.text
    assert "no valid rows" in empty_rooms.json()["detail"]

    # No rooms were accepted, so matching auto-generates them from capacity.
    token = form_token(client, headers, workspace_id)
    for student in cohort("E2E", 4):
        submit(client, token, student["admission_number"], student["phone"], ANSWERS_EARLY)

    segment = client.get(f"/api/workspaces/{workspace_id}/segments", headers=headers).json()["segments"][0]
    assert segment["status"] == "Ready"
    assert segment["total_capacity"] == 4

    run = run_matching(client, headers, workspace_id)
    rooms = room_results(client, headers, workspace_id, run["run_id"])
    generated_ids = [room["room_id"] for room in rooms]
    assert generated_ids == sorted(generated_ids)
    assert len(set(generated_ids)) == 2
    assert all(room_id.startswith(f"{SEGMENT_KEY}_R2_") for room_id in generated_ids)
    assert sorted(row["admission_number"] for room in rooms for row in room["assigned_students"]) == [
        student["admission_number"] for student in cohort("E2E", 4)
    ]


def test_workspace_without_students_cannot_run_matching(
    client: TestClient, db_session: Session, seed_tenant_and_user: dict[str, Any]
) -> None:
    headers = seed_tenant_and_user["headers"]
    workspace_id = create_workspace(client, headers, "Empty workspace")

    run = client.post(
        f"/api/workspaces/{workspace_id}/matching/runs",
        json={"scope": "all_ready_segments", "segment_key": None},
        headers=headers,
    )
    assert run.status_code == 400, run.text
    assert run.json()["detail"] == "No ready segments available"


def test_duplicate_admission_numbers_are_reported_and_only_inserted_once(
    client: TestClient, db_session: Session, seed_tenant_and_user: dict[str, Any]
) -> None:
    headers = seed_tenant_and_user["headers"]
    workspace_id = create_workspace(client, headers, "Duplicate admissions")

    duplicate_rows = [
        {"admission_number": "E2E001", "full_name": "First Occurrence", "phone": "90000000001"},
        {"admission_number": "E2E002", "full_name": "Second Student", "phone": "90000000002"},
        {"admission_number": "E2E001", "full_name": "Second Occurrence", "phone": "90000000003"},
    ]
    apply_result = upload(client, headers, workspace_id, "students", student_csv(duplicate_rows))
    assert apply_result["inserted"] == 2
    assert apply_result["updated"] == 0
    assert [(error["field"], error["reason"]) for error in apply_result["errors"]] == [
        ("admission_number", "duplicate_admission_number_in_file")
    ]
    assert apply_result["errors"][0]["row_number"] == 4

    stored = db_session.scalars(
        select(Student).where(
            Student.workspace_id == uuid.UUID(workspace_id),
            Student.admission_number == "E2E001",
        )
    ).all()
    assert [student.full_name for student in stored] == ["First Occurrence"]


def test_row_with_bad_dob_is_skipped_and_reported(
    client: TestClient, db_session: Session, seed_tenant_and_user: dict[str, Any]
) -> None:
    headers = seed_tenant_and_user["headers"]
    workspace_id = create_workspace(client, headers, "Bad DOB")

    rows = [
        {"admission_number": "E2E001", "full_name": "Valid Student", "phone": "90000000001"},
        {
            "admission_number": "E2E002",
            "full_name": "Invalid DOB Student",
            "phone": "90000000002",
            "dob": "31-12-2005",
        },
    ]
    apply_result = upload(client, headers, workspace_id, "students", student_csv(rows))
    assert apply_result["inserted"] == 1
    assert [(error["field"], error["reason"]) for error in apply_result["errors"]] == [
        ("dob", "invalid_dob_iso_format")
    ]


def test_form_link_stops_working_after_regeneration_and_unknown_tokens_are_rejected(
    client: TestClient, db_session: Session, seed_tenant_and_user: dict[str, Any]
) -> None:
    headers = seed_tenant_and_user["headers"]
    workspace_id = create_workspace(client, headers, "Form link rotation")
    upload(client, headers, workspace_id, "students", student_csv(cohort("E2E", 2)))

    original = form_token(client, headers, workspace_id)
    assert client.get(f"/api/public/forms/{original}").json()["token_valid"] is True

    regenerated = client.post(
        f"/api/workspaces/{workspace_id}/form-link/regenerate", headers=headers
    )
    assert regenerated.status_code == 200, regenerated.text
    replacement = regenerated.json()["token"]
    assert replacement != original

    # The superseded (already-used) link is dead: read and write both refuse it.
    assert client.get(f"/api/public/forms/{original}").json() == {"token_valid": False}
    rejected = client.post(
        f"/api/public/forms/{original}/submit",
        json={
            "submitted_admission_number": "E2E001",
            "submitted_phone_last4": "0001",
            "answers": ANSWERS_EARLY,
        },
    )
    assert rejected.status_code == 400, rejected.text
    assert rejected.json()["detail"] == {"error": "form_link_invalid"}

    # An unknown token behaves the same way and never leaks workspace data.
    unknown = client.get("/api/public/forms/not-a-real-token")
    assert unknown.json() == {"token_valid": False}
    unknown_submit = client.post(
        "/api/public/forms/not-a-real-token/submit",
        json={"submitted_admission_number": "E2E001", "submitted_phone_last4": "0001", "answers": {}},
    )
    assert unknown_submit.status_code == 400, unknown_submit.text

    # The replacement token is live.
    assert client.get(f"/api/public/forms/{replacement}").json()["token_valid"] is True
    assert submit(client, replacement, "E2E001", "90000000001", ANSWERS_EARLY)["valid"] is True
