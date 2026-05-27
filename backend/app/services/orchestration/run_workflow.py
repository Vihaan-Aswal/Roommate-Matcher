from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.matching_run import MatchingRun
from app.models.pair_score import PairScore
from app.models.preference_profile import PreferenceProfile
from app.models.room import Room
from app.models.room_assignment import RoomAssignment
from app.models.segment import Segment
from app.models.student import Student
from app.services.explainability.contracts import RoomExplanationContext
from app.services.explainability.service import generate_room_explanations
from app.services.fairness.distribution import FairnessInputRecord, compute_fairness_distribution
from app.services.matching.adapter import profile_to_scoring_profile
from app.services.matching.contracts import SegmentData
from app.services.matching.engine import run_matching_for_segment
from app.services.scoring.segment_matrix import compute_segment_pair_scores
from app.services.scoring.types import FactorScore, ScoringProfile
from app.services.segments.status import compute_segment_status

RunScope = Literal["segment", "all_ready_segments"]

NEUTRAL_ENCODED_VALUES: dict[str, float] = {
    "q1_enc": 2.5,
    "q2_enc": 2.0,
    "q3_enc": 2.0,
    "q4a_enc": 1.0,
    "q4b_enc": 1.5,
    "q5a_enc": 1.0,
    "q5b_enc": 1.5,
    "q6_enc": 2.0,
    "q7_enc": 2.0,
    "q8_enc": 2.0,
    "q9_enc": 2.0,
    "q10_enc": 1.5,
}


@dataclass(frozen=True)
class MatchingRunStartResult:
    run_id: str
    scope: RunScope
    status: str
    message: str
    segments_matched: int


@dataclass(frozen=True)
class MatchingRunHistoryItem:
    run_id: str
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    status: str
    scope: str
    segments_completed: int
    error_message: str | None


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _new_run_id() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"run_{stamp}_{uuid4().hex[:8]}"


def _neutral_scoring_profile(admission_number: str) -> ScoringProfile:
    return ScoringProfile(
        admission_number=admission_number,
        has_preferences=False,
        q1_enc=NEUTRAL_ENCODED_VALUES["q1_enc"],
        q2_enc=NEUTRAL_ENCODED_VALUES["q2_enc"],
        q3_enc=NEUTRAL_ENCODED_VALUES["q3_enc"],
        q4a_enc=NEUTRAL_ENCODED_VALUES["q4a_enc"],
        q4b_enc=NEUTRAL_ENCODED_VALUES["q4b_enc"],
        q5a_enc=NEUTRAL_ENCODED_VALUES["q5a_enc"],
        q5b_enc=NEUTRAL_ENCODED_VALUES["q5b_enc"],
        q6_enc=NEUTRAL_ENCODED_VALUES["q6_enc"],
        q7_enc=NEUTRAL_ENCODED_VALUES["q7_enc"],
        q8_enc=NEUTRAL_ENCODED_VALUES["q8_enc"],
        q9_enc=NEUTRAL_ENCODED_VALUES["q9_enc"],
        q10_enc=NEUTRAL_ENCODED_VALUES["q10_enc"],
    )


def _ensure_neutral_fallback(profile: ScoringProfile) -> ScoringProfile:
    return ScoringProfile(
        admission_number=profile.admission_number,
        has_preferences=profile.has_preferences,
        q1_enc=profile.q1_enc if profile.q1_enc is not None else NEUTRAL_ENCODED_VALUES["q1_enc"],
        q2_enc=profile.q2_enc if profile.q2_enc is not None else NEUTRAL_ENCODED_VALUES["q2_enc"],
        q3_enc=profile.q3_enc if profile.q3_enc is not None else NEUTRAL_ENCODED_VALUES["q3_enc"],
        q4a_enc=profile.q4a_enc if profile.q4a_enc is not None else NEUTRAL_ENCODED_VALUES["q4a_enc"],
        q4b_enc=profile.q4b_enc if profile.q4b_enc is not None else NEUTRAL_ENCODED_VALUES["q4b_enc"],
        q5a_enc=profile.q5a_enc if profile.q5a_enc is not None else NEUTRAL_ENCODED_VALUES["q5a_enc"],
        q5b_enc=profile.q5b_enc if profile.q5b_enc is not None else NEUTRAL_ENCODED_VALUES["q5b_enc"],
        q6_enc=profile.q6_enc if profile.q6_enc is not None else NEUTRAL_ENCODED_VALUES["q6_enc"],
        q7_enc=profile.q7_enc if profile.q7_enc is not None else NEUTRAL_ENCODED_VALUES["q7_enc"],
        q8_enc=profile.q8_enc if profile.q8_enc is not None else NEUTRAL_ENCODED_VALUES["q8_enc"],
        q9_enc=profile.q9_enc if profile.q9_enc is not None else NEUTRAL_ENCODED_VALUES["q9_enc"],
        q10_enc=profile.q10_enc if profile.q10_enc is not None else NEUTRAL_ENCODED_VALUES["q10_enc"],
    )


def _serialize_factor_breakdown(factor_breakdown: dict[str, FactorScore]) -> dict[str, dict[str, float | bool]]:
    return {
        key: {
            "raw_score": value.raw_score,
            "weight_used": value.weight_used,
            "missing_data": value.missing_data,
        }
        for key, value in factor_breakdown.items()
    }


def _canonical_pair(student_a: str, student_b: str) -> tuple[str, str]:
    return (student_a, student_b) if student_a < student_b else (student_b, student_a)


def _resolve_target_segments(db: Session, scope: RunScope, segment_key: str | None) -> list[Segment]:
    if scope == "segment":
        if not segment_key:
            raise ValueError("segment_key is required when scope is segment")

        segment = db.scalars(select(Segment).where(Segment.segment_key == segment_key)).first()
        if segment is None:
            raise ValueError("Segment not found")

        status = compute_segment_status(db, segment_key)
        if status.status != "Ready":
            raise ValueError("Segment not ready for matching")
        return [segment]

    if scope == "all_ready_segments":
        if segment_key is not None:
            raise ValueError("segment_key must be null when scope is all_ready_segments")

        segments = db.scalars(select(Segment).order_by(Segment.segment_key)).all()
        ready_segments = [segment for segment in segments if compute_segment_status(db, segment.segment_key).status == "Ready"]
        if not ready_segments:
            raise ValueError("No ready segments available")
        return ready_segments

    raise ValueError("Invalid scope")


def _segment_scoring_profiles(db: Session, segment: Segment) -> tuple[list[str], list[ScoringProfile]]:
    students = db.scalars(
        select(Student)
        .where(Student.segment_key == segment.segment_key)
        .order_by(Student.admission_number)
    ).all()
    student_ids = [student.admission_number for student in students]
    if not student_ids:
        raise ValueError(f"No students found for segment {segment.segment_key}")
    student_id_set = set(student_ids)

    active_profiles = db.scalars(
        select(PreferenceProfile).where(
            PreferenceProfile.is_active == 1,
            PreferenceProfile.admission_number.in_(student_ids),
        )
    ).all()
    profile_map = {
        profile.admission_number: profile
        for profile in active_profiles
        if profile.admission_number in student_id_set
    }

    scoring_profiles: list[ScoringProfile] = []
    for student_id in student_ids:
        profile = profile_map.get(student_id)
        if profile is None:
            scoring_profiles.append(_neutral_scoring_profile(student_id))
            continue
        scoring_profiles.append(_ensure_neutral_fallback(profile_to_scoring_profile(profile)))

    return student_ids, scoring_profiles


def _resolve_room_ids(db: Session, segment: Segment, student_count: int) -> list[str] | None:
    rooms = db.scalars(
        select(Room)
        .where(Room.segment_key == segment.segment_key)
        .order_by(Room.room_id)
    ).all()
    if not rooms:
        return None

    expected_room_count = student_count // segment.room_size
    if len(rooms) < expected_room_count:
        raise ValueError(f"Not enough rooms uploaded for segment {segment.segment_key}")
    return [room.room_id for room in rooms[:expected_room_count]]


def _persist_segment_artifacts(
    db: Session,
    *,
    run_id: str,
    segment: Segment,
) -> list[FairnessInputRecord]:
    student_ids, scoring_profiles = _segment_scoring_profiles(db, segment)
    pair_results = compute_segment_pair_scores(scoring_profiles)
    room_ids = _resolve_room_ids(db, segment, len(student_ids))

    matching_result = run_matching_for_segment(
        SegmentData(
            segment_key=segment.segment_key,
            room_size=segment.room_size,
            student_ids=student_ids,
            pair_results=pair_results,
            room_ids=room_ids,
        )
    )

    for (student_a, student_b), pair_result in sorted(pair_results.items()):
        db.add(
            PairScore(
                run_id=run_id,
                segment_key=segment.segment_key,
                student_a=student_a,
                student_b=student_b,
                pair_score=pair_result.pair_score,
                factor_breakdown_json=json.dumps(
                    _serialize_factor_breakdown(pair_result.factor_breakdown),
                    sort_keys=True,
                ),
            )
        )

    student_result_map = {item.student_id: item for item in matching_result.students}
    fairness_records: list[FairnessInputRecord] = []

    for student in matching_result.students:
        fairness_records.append(
            FairnessInputRecord(
                student_id=student.student_id,
                segment_key=segment.segment_key,
                satisfaction_score=student.satisfaction_score,
                satisfaction_label=student.satisfaction_label,
                is_at_risk=student.is_at_risk,
            )
        )

    for room in matching_result.rooms:
        room_students = [student_result_map[student_id] for student_id in room.student_ids]
        room_context = RoomExplanationContext(
            segment_key=segment.segment_key,
            room_id=room.room_id,
            room_size=segment.room_size,
            student_ids=room.student_ids,
            pair_results=pair_results,
            student_satisfaction={item.student_id: item.satisfaction_score for item in room_students},
            student_labels={item.student_id: item.satisfaction_label for item in room_students},
            student_at_risk={item.student_id: item.is_at_risk for item in room_students},
            reason_mode="assigned_room",
        )
        explanations = generate_room_explanations(room_context)
        explanation_map = {item.student_id: item for item in explanations}

        student_payload = []
        for student in sorted(room_students, key=lambda row: row.student_id):
            explanation = explanation_map[student.student_id]
            student_payload.append(
                {
                    "student_id": student.student_id,
                    "room_id": student.room_id,
                    "roommate_ids": student.roommate_ids,
                    "satisfaction_score": student.satisfaction_score,
                    "satisfaction_label": student.satisfaction_label,
                    "excellent_safety_passed": student.excellent_safety_passed,
                    "is_at_risk": student.is_at_risk,
                    "reasons": explanation.reasons,
                    "factor_trace": explanation.factor_trace,
                }
            )

        db.add(
            RoomAssignment(
                run_id=run_id,
                segment_key=segment.segment_key,
                room_id=room.room_id,
                room_label=room.room_id,
                assigned_students_json=json.dumps(sorted(room.student_ids)),
                group_score=room.group_score,
                satisfaction_summary_json=json.dumps(
                    {
                        "students": student_payload,
                    },
                    sort_keys=True,
                ),
                needs_review=1 if room.needs_review else 0,
            )
        )

    return fairness_records


def run_matching_workflow(db: Session, scope: RunScope, segment_key: str | None) -> MatchingRunStartResult:
    targets = _resolve_target_segments(db, scope, segment_key)
    run_id = _new_run_id()
    started_at = _now_utc()

    run_row = MatchingRun(
        run_id=run_id,
        scope=scope,
        target_segment_key=segment_key if scope == "segment" else None,
        status="running",
        started_at=started_at,
    )
    db.add(run_row)
    db.commit()

    try:
        fairness_inputs: list[FairnessInputRecord] = []
        for segment in targets:
            fairness_inputs.extend(
                _persist_segment_artifacts(
                    db,
                    run_id=run_id,
                    segment=segment,
                )
            )

        fairness_report = compute_fairness_distribution(fairness_inputs)
        persisted_run = db.get(MatchingRun, run_id)
        if persisted_run is None:
            raise RuntimeError("Matching run row disappeared during execution")
        persisted_run.fairness_summary_json = json.dumps(asdict(fairness_report), sort_keys=True)
        persisted_run.status = "completed"
        persisted_run.finished_at = _now_utc()
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        failed_run = db.get(MatchingRun, run_id)
        if failed_run is not None:
            failed_run.status = "failed"
            failed_run.error_message = str(exc)
            failed_run.finished_at = _now_utc()
            db.commit()
        raise

    return MatchingRunStartResult(
        run_id=run_id,
        scope=scope,
        status="completed",
        message="Matching run completed successfully.",
        segments_matched=len(targets),
    )


def list_matching_runs(db: Session) -> list[MatchingRunHistoryItem]:
    runs = db.scalars(select(MatchingRun).order_by(MatchingRun.created_at.desc())).all()
    results: list[MatchingRunHistoryItem] = []
    for run in runs:
        segments_completed = db.scalar(
            select(func.count(func.distinct(RoomAssignment.segment_key))).where(RoomAssignment.run_id == run.run_id)
        )
        results.append(
            MatchingRunHistoryItem(
                run_id=run.run_id,
                created_at=run.created_at,
                started_at=run.started_at,
                finished_at=run.finished_at,
                status=run.status,
                scope=run.scope,
                segments_completed=int(segments_completed or 0),
                error_message=run.error_message,
            )
        )
    return results


def get_run_rooms_from_persisted_artifacts(
    db: Session,
    *,
    run_id: str,
    segment_key: str,
) -> list[dict[str, object]]:
    assignments = db.scalars(
        select(RoomAssignment)
        .where(
            RoomAssignment.run_id == run_id,
            RoomAssignment.segment_key == segment_key,
        )
        .order_by(RoomAssignment.room_id)
    ).all()
    if not assignments:
        raise KeyError("Matching artifacts not found for run and segment")

    pair_score_rows = db.scalars(
        select(PairScore).where(
            PairScore.run_id == run_id,
            PairScore.segment_key == segment_key,
        )
    ).all()
    pair_score_map = {
        _canonical_pair(row.student_a, row.student_b): row.pair_score
        for row in pair_score_rows
    }

    all_student_ids: set[str] = set()
    parsed_assignments: list[tuple[RoomAssignment, list[str], dict[str, object]]] = []
    for assignment in assignments:
        assigned_students = json.loads(assignment.assigned_students_json)
        if not isinstance(assigned_students, list):
            raise ValueError("assigned_students_json must be a JSON list")
        summary = json.loads(assignment.satisfaction_summary_json or "{}")
        if not isinstance(summary, dict):
            raise ValueError("satisfaction_summary_json must be a JSON object")
        parsed_assignments.append((assignment, [str(item) for item in assigned_students], summary))
        all_student_ids.update(str(item) for item in assigned_students)

    students = db.scalars(
        select(Student).where(Student.admission_number.in_(sorted(all_student_ids)))
    ).all()
    student_name_map = {student.admission_number: student.full_name for student in students}

    rooms_payload: list[dict[str, object]] = []
    for assignment, assigned_students, _summary in parsed_assignments:
        room_students: list[dict[str, object]] = []
        for student_id in assigned_students:
            roommate_scores = {
                roommate_id: pair_score_map.get(_canonical_pair(student_id, roommate_id), 0.0)
                for roommate_id in assigned_students
                if roommate_id != student_id
            }
            room_students.append(
                {
                    "admission_number": student_id,
                    "full_name": student_name_map.get(student_id, student_id),
                    "pair_scores_with_roommates": roommate_scores,
                }
            )

        rooms_payload.append(
            {
                "room_id": assignment.room_id,
                "room_size": len(assigned_students),
                "assigned_students": room_students,
                "group_score": assignment.group_score,
                "needs_review": bool(assignment.needs_review),
            }
        )

    return rooms_payload


def get_run_students_from_persisted_artifacts(
    db: Session,
    *,
    run_id: str,
    segment_key: str,
) -> list[dict[str, object]]:
    assignments = db.scalars(
        select(RoomAssignment)
        .where(
            RoomAssignment.run_id == run_id,
            RoomAssignment.segment_key == segment_key,
        )
        .order_by(RoomAssignment.room_id)
    ).all()
    if not assignments:
        raise KeyError("Matching artifacts not found for run and segment")

    all_student_ids: set[str] = set()
    parsed_rooms: list[tuple[str, list[str], dict[str, object]]] = []
    for assignment in assignments:
        assigned_students = json.loads(assignment.assigned_students_json)
        summary = json.loads(assignment.satisfaction_summary_json or "{}")
        if not isinstance(assigned_students, list):
            raise ValueError("assigned_students_json must be a JSON list")
        if not isinstance(summary, dict):
            raise ValueError("satisfaction_summary_json must be a JSON object")
        parsed_rooms.append((assignment.room_id, [str(item) for item in assigned_students], summary))
        all_student_ids.update(str(item) for item in assigned_students)

    students = db.scalars(
        select(Student).where(Student.admission_number.in_(sorted(all_student_ids)))
    ).all()
    student_name_map = {student.admission_number: student.full_name for student in students}

    student_payload: list[dict[str, object]] = []
    for room_id, assigned_students, summary in parsed_rooms:
        summary_students = summary.get("students", [])
        summary_map = {
            str(item.get("student_id")): item
            for item in summary_students
            if isinstance(item, dict) and item.get("student_id") is not None
        }

        for student_id in assigned_students:
            item = summary_map.get(student_id)
            if item is None:
                raise ValueError("Persisted room summary is missing a student record")

            student_payload.append(
                {
                    "admission_number": student_id,
                    "full_name": student_name_map.get(student_id, student_id),
                    "room_id": room_id,
                    "roommate_ids": [str(value) for value in item.get("roommate_ids", [])],
                    "satisfaction_score": float(item.get("satisfaction_score", 0.0)),
                    "satisfaction_label": str(item.get("satisfaction_label", "Poor")),
                    "is_at_risk": bool(item.get("is_at_risk", False)),
                    "reasons": [str(value) for value in item.get("reasons", [])],
                    "factor_trace": item.get("factor_trace", []),
                }
            )

    return sorted(student_payload, key=lambda row: str(row["admission_number"]))


def get_run_fairness_snapshot(db: Session, run_id: str) -> dict[str, object]:
    run_row = db.get(MatchingRun, run_id)
    if run_row is None:
        raise KeyError("Matching run not found")
    if run_row.fairness_summary_json is None:
        raise KeyError("Fairness snapshot not found for run")

    fairness_payload = json.loads(run_row.fairness_summary_json)
    if not isinstance(fairness_payload, dict):
        raise ValueError("fairness_summary_json must be a JSON object")

    by_segment = fairness_payload.get("by_segment")
    if isinstance(by_segment, list):
        fairness_payload["by_segment"] = sorted(
            by_segment,
            key=lambda row: str(row.get("segment_key", "")) if isinstance(row, dict) else "",
        )
    return fairness_payload