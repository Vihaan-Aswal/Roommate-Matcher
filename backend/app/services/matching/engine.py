from __future__ import annotations

from dataclasses import asdict, is_dataclass

from app.services.matching.contracts import (
    MatchingResult,
    RoomAssignmentResult,
    RoomMetricRecord,
    SegmentData,
    StudentSatisfactionRecord,
)
from app.services.matching.errors import SegmentValidationError
from app.services.matching.invariants import validate_room_assignments
from app.services.matching.labels import classify_student
from app.services.matching.matcher_2bed import match_2bed
from app.services.matching.matcher_3bed import match_3bed
from app.services.matching.matcher_4bed import match_4bed
from app.services.matching.pair_lookup import normalize_and_validate_pair_results
from app.services.matching.room_ids import assign_room_ids
from app.services.matching.satisfaction import compute_group_score, compute_student_satisfaction_scores
from app.services.matching.swap_optimizer import optimize_swaps


def _coerce_segment_data(segment_data: SegmentData | dict[str, object]) -> SegmentData:
    if isinstance(segment_data, SegmentData):
        return segment_data

    if is_dataclass(segment_data):
        return SegmentData(**asdict(segment_data))

    if isinstance(segment_data, dict):
        try:
            return SegmentData(**segment_data)
        except TypeError as exc:
            raise SegmentValidationError(f"Invalid segment_data shape: {exc}") from exc

    raise SegmentValidationError("segment_data must be a SegmentData instance or a dict")


def _validate_segment_data(segment_data: SegmentData) -> None:
    if segment_data.room_size not in (2, 3, 4):
        raise SegmentValidationError(f"Invalid room_size: {segment_data.room_size}")

    if not segment_data.student_ids:
        raise SegmentValidationError("student_ids must be non-empty")

    if len(set(segment_data.student_ids)) != len(segment_data.student_ids):
        raise SegmentValidationError("student_ids must be unique")

    if len(segment_data.student_ids) % segment_data.room_size != 0:
        raise SegmentValidationError(
            f"Student count {len(segment_data.student_ids)} is not divisible by room_size {segment_data.room_size}"
        )

    if segment_data.room_ids is not None:
        expected_rooms = len(segment_data.student_ids) // segment_data.room_size
        if len(segment_data.room_ids) != expected_rooms:
            raise SegmentValidationError(
                f"room_ids count {len(segment_data.room_ids)} does not match expected room count {expected_rooms}"
            )
        if len(set(segment_data.room_ids)) != len(segment_data.room_ids):
            raise SegmentValidationError("room_ids must be unique")


def _dispatch_matcher(
    room_size: int,
    student_ids: list[str],
    pair_results: dict[tuple[str, str], object],
) -> list[list[str]]:
    if room_size == 2:
        return match_2bed(student_ids, pair_results)
    if room_size == 3:
        return match_3bed(student_ids, pair_results)
    if room_size == 4:
        return match_4bed(student_ids, pair_results)
    raise SegmentValidationError(f"Unsupported room_size: {room_size}")


def run_matching_for_segment(segment_data: SegmentData | dict[str, object]) -> MatchingResult:
    parsed_data = _coerce_segment_data(segment_data)
    _validate_segment_data(parsed_data)

    ordered_students = sorted(parsed_data.student_ids)
    normalized_pair_results = normalize_and_validate_pair_results(ordered_students, parsed_data.pair_results)

    raw_rooms = _dispatch_matcher(parsed_data.room_size, ordered_students, normalized_pair_results)
    validate_room_assignments(ordered_students, raw_rooms, parsed_data.room_size)

    initial_assignments = assign_room_ids(
        segment_key=parsed_data.segment_key,
        room_size=parsed_data.room_size,
        rooms=raw_rooms,
        provided_room_ids=parsed_data.room_ids,
    )

    room_state: dict[str, list[str]] = {
        room_id: sorted(students)
        for room_id, students in initial_assignments
    }
    optimized_state, swap_passes_applied = optimize_swaps(room_state, normalized_pair_results, max_passes=3)

    optimized_rooms = [sorted(students) for students in optimized_state.values()]
    validate_room_assignments(ordered_students, optimized_rooms, parsed_data.room_size)

    rooms_out: list[RoomAssignmentResult] = []
    students_out: list[StudentSatisfactionRecord] = []
    room_metrics_out: list[RoomMetricRecord] = []

    label_counts = {"Excellent": 0, "Good": 0, "Okay": 0, "Poor": 0}
    at_risk_student_ids: list[str] = []

    for room_id in sorted(optimized_state):
        room_students = sorted(optimized_state[room_id])
        room_group_score = compute_group_score(room_students, normalized_pair_results)
        student_scores = compute_student_satisfaction_scores(room_students, normalized_pair_results)

        room_poor_count = 0
        for student_id in room_students:
            roommates = [roommate for roommate in room_students if roommate != student_id]
            satisfaction_score = student_scores[student_id]
            label, safety_passed, is_at_risk = classify_student(
                student_id=student_id,
                roommate_ids=roommates,
                satisfaction_score=satisfaction_score,
                pair_results=normalized_pair_results,
            )

            if label == "Poor":
                room_poor_count += 1
            if is_at_risk:
                at_risk_student_ids.append(student_id)

            label_counts[label] += 1

            students_out.append(
                StudentSatisfactionRecord(
                    student_id=student_id,
                    room_id=room_id,
                    roommate_ids=sorted(roommates),
                    satisfaction_score=satisfaction_score,
                    satisfaction_label=label,
                    excellent_safety_passed=safety_passed,
                    is_at_risk=is_at_risk,
                )
            )

        room_min_satisfaction = min(student_scores.values()) if student_scores else 0.0
        room_metrics_out.append(
            RoomMetricRecord(
                room_id=room_id,
                group_score=room_group_score,
                min_student_satisfaction=room_min_satisfaction,
                poor_count=room_poor_count,
            )
        )

        rooms_out.append(
            RoomAssignmentResult(
                room_id=room_id,
                segment_key=parsed_data.segment_key,
                room_size=parsed_data.room_size,
                student_ids=room_students,
                group_score=room_group_score,
                needs_review=room_poor_count > 0,
            )
        )

    rooms_out.sort(key=lambda room: room.room_id)
    room_metrics_out.sort(key=lambda metric: metric.room_id)
    students_out.sort(key=lambda student: student.student_id)
    unique_at_risk = sorted(set(at_risk_student_ids))

    minimum_satisfaction = min((student.satisfaction_score for student in students_out), default=0.0)

    return MatchingResult(
        segment_key=parsed_data.segment_key,
        room_size=parsed_data.room_size,
        rooms=rooms_out,
        students=students_out,
        room_metrics=room_metrics_out,
        at_risk_student_ids=unique_at_risk,
        label_counts=label_counts,
        swap_passes_applied=swap_passes_applied,
        minimum_satisfaction=minimum_satisfaction,
    )
