"""Determinism and allocation invariants.

Two layers, both real:

* matching engine: same input twice -> byte-identical plan; label/at-risk rule
  exact on both sides of every threshold.
* routes: a run over two live segments respects capacity, gender and segment
  boundaries, assigns every student exactly once and never pairs across
  segments; repeating the run reproduces the same plan.
"""
from __future__ import annotations

import json
import math
import uuid
from datetime import date
from typing import Any

import pytest
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
from app.models.workspace import Workspace
from app.services.matching.contracts import SegmentData
from app.services.matching.engine import run_matching_for_segment
from app.services.matching.labels import classify_student, derive_satisfaction_label
from app.services.scoring.types import FactorScore, PairResult

MALE_SEGMENT = "M_1st_year_AC_2"
FEMALE_SEGMENT = "F_1st_year_NonAC_3"


def _pair_result(score: float, *, excellent: bool) -> PairResult:
    return PairResult(
        pair_score=score,
        factor_breakdown={"q1_enc": FactorScore(raw_score=score, weight_used=1.0, missing_data=False)},
        excellent_candidate=excellent,
    )


def _pair_matrix(student_ids: list[str], score: float) -> dict[tuple[str, str], PairResult]:
    ordered = sorted(student_ids)
    return {
        (left, right): _pair_result(score, excellent=score >= 0.90)
        for index, left in enumerate(ordered)
        for right in ordered[index + 1 :]
    }


def _two_bed(score: float, *, excellent: bool) -> SegmentData:
    return SegmentData(
        segment_key="THRESHOLD",
        room_size=2,
        student_ids=["S-001", "S-002"],
        room_ids=["ROOM-1"],
        pair_results={("S-001", "S-002"): _pair_result(score, excellent=excellent)},
    )


def _json_column(value: Any) -> Any:
    return json.loads(value) if isinstance(value, str) else value


# ---------------------------------------------------------------------------
# Engine level
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    ("room_size", "student_count", "score"),
    [(2, 10, 0.75), (3, 9, 0.62), (4, 8, 0.81)],
)
def test_same_engine_input_twice_produces_identical_plan(
    room_size: int, student_count: int, score: float
) -> None:
    student_ids = [f"D{index:03d}" for index in range(1, student_count + 1)]
    segment = SegmentData(
        segment_key=f"SEG_{room_size}BED",
        room_size=room_size,
        student_ids=student_ids,
        pair_results=_pair_matrix(student_ids, score),
    )

    first = run_matching_for_segment(segment)
    second = run_matching_for_segment(segment)

    assert first == second
    assert [room.room_id for room in first.rooms] == [room.room_id for room in second.rooms]
    assert [student.student_id for student in first.students] == [
        student.student_id for student in second.students
    ]


@pytest.mark.parametrize(
    ("score", "excellent", "expected_label", "expected_at_risk"),
    [
        (0.90, True, "Excellent", False),
        (0.90, False, "Good", False),
        (math.nextafter(0.90, 0.0), True, "Good", False),
        (0.70, True, "Good", False),
        (math.nextafter(0.70, 0.0), True, "Okay", False),
        (0.55, True, "Okay", False),
        (math.nextafter(0.55, 0.0), True, "Poor", True),
        (0.0, True, "Poor", True),
    ],
)
def test_label_and_at_risk_rule_is_exact_at_thresholds(
    score: float, excellent: bool, expected_label: str, expected_at_risk: bool
) -> None:
    # Pure rule.
    label = derive_satisfaction_label(satisfaction_score=score, safety_passed=excellent)
    assert label == expected_label
    _, _, is_at_risk = classify_student(
        student_id="S-001",
        roommate_ids=["S-002"],
        satisfaction_score=score,
        pair_results={("S-001", "S-002"): _pair_result(score, excellent=excellent)},
    )
    assert is_at_risk is expected_at_risk

    # Same rule as applied by the engine to a two-bed room.
    result = run_matching_for_segment(_two_bed(score, excellent=excellent))
    assert [student.satisfaction_label for student in result.students] == [expected_label, expected_label]
    assert [student.is_at_risk for student in result.students] == [expected_at_risk, expected_at_risk]
    assert result.at_risk_student_ids == (["S-001", "S-002"] if expected_at_risk else [])
    assert result.rooms[0].needs_review is expected_at_risk


@pytest.mark.parametrize(
    ("room_size", "student_count"),
    [(2, 10), (3, 9), (4, 8), (2, 9), (3, 10), (4, 7)],
)
def test_every_student_is_assigned_exactly_once(room_size: int, student_count: int) -> None:
    student_ids = [f"U{index:03d}" for index in range(1, student_count + 1)]
    result = run_matching_for_segment(
        SegmentData(
            segment_key=f"SEG_{room_size}BED_FULL",
            room_size=room_size,
            student_ids=student_ids,
            pair_results=_pair_matrix(student_ids, 0.66),
        )
    )

    assigned = [student_id for room in result.rooms for student_id in room.student_ids]
    assert sorted(assigned) == sorted(student_ids)
    assert len(assigned) == len(set(assigned))

    remainder = student_count % room_size
    sizes = [len(room.student_ids) for room in result.rooms]
    if remainder:
        # Only the final leftover room may be smaller than the segment room size.
        assert sizes[-1] == remainder
        assert sizes[:-1] == [room_size] * (len(sizes) - 1)
    else:
        assert sizes == [room_size] * len(sizes)

    assert sum(result.label_counts.values()) == student_count
    assert len(result.students) == student_count


# ---------------------------------------------------------------------------
# Route level seeding
# ---------------------------------------------------------------------------

def _seed_two_segments(db_session: Session, tenant_id: uuid.UUID) -> tuple[uuid.UUID, dict[str, uuid.UUID]]:
    ws = Workspace(tenant_id=tenant_id, name="Determinism WS", status="draft", source="manual")
    db_session.add(ws)
    db_session.flush()

    plan = {
        MALE_SEGMENT: {
            "gender": "M",
            "room_size": 2,
            "admissions": ["M-001", "M-002", "M-003", "M-004"],
            "rooms": ["M-R1", "M-R2"],
            "encoded": (1.0, 2.0),
        },
        FEMALE_SEGMENT: {
            "gender": "F",
            "room_size": 3,
            "admissions": ["F-001", "F-002", "F-003"],
            "rooms": ["F-R1"],
            "encoded": (3.0, 1.0),
        },
    }

    segment_ids: dict[str, uuid.UUID] = {}
    for segment_key, config in plan.items():
        ac_type = "AC" if segment_key == MALE_SEGMENT else "NonAC"
        segment = Segment(
            tenant_id=tenant_id,
            workspace_id=ws.id,
            segment_key=segment_key,
            gender=config["gender"],
            year_group="1st_year",
            ac_type=ac_type,
            room_size=config["room_size"],
        )
        db_session.add(segment)
        db_session.flush()
        segment_ids[segment_key] = segment.id

        for index, admission in enumerate(config["admissions"]):
            student = Student(
                tenant_id=tenant_id,
                workspace_id=ws.id,
                segment_id=segment.id,
                admission_number=admission,
                full_name=f"{config['gender']} Student {index}",
                gender=config["gender"],
                year_group="1st_year",
                ac_type=ac_type,
                room_size=config["room_size"],
                dob=date(2005, 1, 1 + index),
                phone_number=f"98765{index:05d}",
                phone_last4=f"{index:04d}",
                is_active=True,
            )
            db_session.add(student)
            db_session.flush()
            db_session.add(
                PreferenceProfile(
                    tenant_id=tenant_id,
                    workspace_id=ws.id,
                    student_id=student.id,
                    has_preferences=True,
                    is_active=True,
                    is_generated=False,
                    q1_enc=config["encoded"][0],
                    q2_enc=config["encoded"][1],
                    q3_enc=config["encoded"][0],
                    q4a_enc=config["encoded"][1],
                    q4b_enc=config["encoded"][0],
                    q5a_enc=config["encoded"][1],
                    q5b_enc=config["encoded"][0],
                    q6_enc=config["encoded"][1],
                    q7_enc=config["encoded"][0],
                    q8_enc=config["encoded"][1],
                    q9_enc=config["encoded"][0],
                    q10_enc=config["encoded"][1],
                )
            )

        for room_id in config["rooms"]:
            db_session.add(
                Room(
                    tenant_id=tenant_id,
                    workspace_id=ws.id,
                    segment_id=segment.id,
                    room_id=room_id,
                    capacity=config["room_size"],
                    source="uploaded",
                    is_active=True,
                )
            )

    db_session.commit()
    return ws.id, segment_ids


def _start_run(client: TestClient, headers: dict[str, str], workspace_id: uuid.UUID) -> str:
    response = client.post(
        f"/api/workspaces/{workspace_id}/matching/runs",
        json={"scope": "all_ready_segments", "segment_key": None},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "completed"
    assert payload["segments_matched"] == 2
    return payload["run_id"]


# ---------------------------------------------------------------------------
# Route level
# ---------------------------------------------------------------------------

def test_run_respects_capacity_gender_and_segment_boundaries(
    client: TestClient, db_session: Session, seed_tenant_and_user: dict[str, Any]
) -> None:
    headers = seed_tenant_and_user["headers"]
    workspace_id, segment_ids = _seed_two_segments(db_session, seed_tenant_and_user["tenant_id"])
    run_id = _start_run(client, headers, workspace_id)

    run_row = db_session.scalars(select(MatchingRun).where(MatchingRun.run_id == run_id)).one()
    assignments = db_session.scalars(
        select(RoomAssignment).where(RoomAssignment.matching_run_id == run_row.id)
    ).all()
    assert assignments

    student_rows = {
        student.admission_number: student
        for student in db_session.scalars(select(Student).where(Student.workspace_id == workspace_id)).all()
    }
    room_rows = {
        (room.segment_id, room.room_id): room
        for room in db_session.scalars(select(Room).where(Room.workspace_id == workspace_id)).all()
    }

    assigned_per_segment: dict[uuid.UUID, list[str]] = {}
    for assignment in assignments:
        segment = db_session.get(Segment, assignment.segment_id)
        assert segment is not None
        assigned = [str(item) for item in _json_column(assignment.assigned_students_json)]
        assert sorted(assigned) == assigned
        assigned_per_segment.setdefault(assignment.segment_id, []).extend(assigned)

        room = room_rows[(assignment.segment_id, assignment.room_id)]
        assert room.capacity == segment.room_size
        assert len(assigned) == segment.room_size

        for admission in assigned:
            student = student_rows[admission]
            assert student.segment_id == assignment.segment_id
            assert student.gender == segment.gender

    for segment_id in segment_ids.values():
        segment = db_session.get(Segment, segment_id)
        assert segment is not None
        expected_count = len([s for s in student_rows.values() if s.segment_id == segment_id])
        assigned = assigned_per_segment[segment_id]
        assert len(assigned) == expected_count
        assert len(set(assigned)) == expected_count
        expected_rooms = math.ceil(expected_count / segment.room_size)
        assert len({a.room_id for a in assignments if a.segment_id == segment_id}) == expected_rooms


def test_run_never_pairs_students_from_different_segments(
    client: TestClient, db_session: Session, seed_tenant_and_user: dict[str, Any]
) -> None:
    headers = seed_tenant_and_user["headers"]
    workspace_id, segment_ids = _seed_two_segments(db_session, seed_tenant_and_user["tenant_id"])
    run_id = _start_run(client, headers, workspace_id)

    run_row = db_session.scalars(select(MatchingRun).where(MatchingRun.run_id == run_id)).one()
    segment_by_student_id = {
        student.id: student.segment_id
        for student in db_session.scalars(select(Student).where(Student.workspace_id == workspace_id)).all()
    }
    segment_by_admission = {
        student.admission_number: student.segment_id
        for student in db_session.scalars(select(Student).where(Student.workspace_id == workspace_id)).all()
    }

    pair_scores = db_session.scalars(
        select(PairScore).where(PairScore.matching_run_id == run_row.id)
    ).all()
    assert pair_scores
    for pair in pair_scores:
        segment_a = segment_by_student_id[pair.student_a_id]
        segment_b = segment_by_student_id[pair.student_b_id]
        assert segment_a == segment_b
        assert segment_a in segment_ids.values()

    # Route-level view: roommates reported to the UI are always same-segment.
    for segment_key in (MALE_SEGMENT, FEMALE_SEGMENT):
        rooms = client.get(
            f"/api/workspaces/{workspace_id}/matching/runs/{run_id}/rooms",
            params={"segment_key": segment_key},
            headers=headers,
        )
        assert rooms.status_code == 200, rooms.text
        for room in rooms.json()["rooms"]:
            admissions = [row["admission_number"] for row in room["assigned_students"]]
            segments = {segment_by_admission[admission] for admission in admissions}
            assert segments == {segment_ids[segment_key]}


def test_repeating_the_run_reproduces_the_same_plan(
    client: TestClient, db_session: Session, seed_tenant_and_user: dict[str, Any]
) -> None:
    headers = seed_tenant_and_user["headers"]
    workspace_id, _segment_ids = _seed_two_segments(db_session, seed_tenant_and_user["tenant_id"])

    first_run = _start_run(client, headers, workspace_id)
    second_run = _start_run(client, headers, workspace_id)
    assert first_run != second_run

    def snapshot(run_id: str) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        for segment_key in (MALE_SEGMENT, FEMALE_SEGMENT):
            rooms = client.get(
                f"/api/workspaces/{workspace_id}/matching/runs/{run_id}/rooms",
                params={"segment_key": segment_key},
                headers=headers,
            )
            students = client.get(
                f"/api/workspaces/{workspace_id}/matching/runs/{run_id}/students",
                params={"segment_key": segment_key},
                headers=headers,
            )
            assert rooms.status_code == 200, rooms.text
            assert students.status_code == 200, students.text
            payload[segment_key] = {
                "rooms": [
                    (
                        room["room_id"],
                        [row["admission_number"] for row in room["assigned_students"]],
                        round(room["group_score"], 12),
                    )
                    for room in rooms.json()["rooms"]
                ],
                "students": [
                    (
                        row["admission_number"],
                        row["room_id"],
                        row["roommate_ids"],
                        round(row["satisfaction_score"], 12),
                        row["satisfaction_label"],
                        row["is_at_risk"],
                    )
                    for row in students.json()["students"]
                ],
            }
        return payload

    assert snapshot(first_run) == snapshot(second_run)

    fairness_first = client.get(
        f"/api/workspaces/{workspace_id}/fairness/{first_run}", headers=headers
    ).json()
    fairness_second = client.get(
        f"/api/workspaces/{workspace_id}/fairness/{second_run}", headers=headers
    ).json()
    for key in ("total_students", "run_label_counts", "run_at_risk_count", "run_at_risk_student_ids"):
        assert fairness_first[key] == fairness_second[key]
    assert fairness_first["by_segment"] == fairness_second["by_segment"]


def test_every_active_student_appears_in_exactly_one_room_of_the_run(
    client: TestClient, db_session: Session, seed_tenant_and_user: dict[str, Any]
) -> None:
    headers = seed_tenant_and_user["headers"]
    workspace_id, _segment_ids = _seed_two_segments(db_session, seed_tenant_and_user["tenant_id"])
    run_id = _start_run(client, headers, workspace_id)

    active_admissions = {
        student.admission_number
        for student in db_session.scalars(
            select(Student).where(Student.workspace_id == workspace_id, Student.is_active == True)  # noqa: E712
        ).all()
    }

    assigned: list[str] = []
    for segment_key in (MALE_SEGMENT, FEMALE_SEGMENT):
        students = client.get(
            f"/api/workspaces/{workspace_id}/matching/runs/{run_id}/students",
            params={"segment_key": segment_key},
            headers=headers,
        )
        assert students.status_code == 200, students.text
        assigned.extend(row["admission_number"] for row in students.json()["students"])

    # The all-segments view must agree with the per-segment views.
    all_segments = client.get(
        f"/api/workspaces/{workspace_id}/matching/runs/{run_id}/students/all-segments",
        headers=headers,
    )
    assert all_segments.status_code == 200, all_segments.text
    from_all_segments = [
        row["admission_number"]
        for block in all_segments.json()["segments"]
        for row in block["students"]
    ]

    assert sorted(assigned) == sorted(active_admissions)
    assert len(assigned) == len(set(assigned))
    assert sorted(from_all_segments) == sorted(active_admissions)
