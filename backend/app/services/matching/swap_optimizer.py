from __future__ import annotations

from dataclasses import dataclass

from app.services.matching.contracts import SatisfactionLabel
from app.services.matching.labels import classify_student
from app.services.matching.satisfaction import compute_student_satisfaction_scores
from app.services.scoring.types import PairResult

EPSILON = 1e-12


@dataclass(frozen=True)
class _StateEvaluation:
    minimum_satisfaction: float
    poor_count: int
    total_satisfaction: float
    labels_by_student: dict[str, SatisfactionLabel]


@dataclass(frozen=True)
class _RoomEvaluation:
    minimum_satisfaction: float
    poor_count: int
    total_satisfaction: float
    labels_by_student: dict[str, SatisfactionLabel]


def _evaluate_room(
    room_students: list[str],
    pair_results: dict[tuple[str, str], PairResult],
) -> _RoomEvaluation:
    students = sorted(room_students)
    satisfaction_scores = compute_student_satisfaction_scores(students, pair_results)
    labels_by_student: dict[str, SatisfactionLabel] = {}
    scores: list[float] = []

    for student_id in students:
        roommates = [roommate for roommate in students if roommate != student_id]
        score = satisfaction_scores[student_id]
        label, _, _ = classify_student(student_id, roommates, score, pair_results)
        labels_by_student[student_id] = label
        scores.append(score)

    return _RoomEvaluation(
        minimum_satisfaction=min(scores) if scores else 0.0,
        poor_count=sum(1 for label in labels_by_student.values() if label == "Poor"),
        total_satisfaction=sum(scores),
        labels_by_student=labels_by_student,
    )


def _evaluate_state(
    room_assignments: dict[str, list[str]],
    pair_results: dict[tuple[str, str], PairResult],
) -> _StateEvaluation:
    labels_by_student: dict[str, SatisfactionLabel] = {}
    minimum_satisfaction = 0.0
    poor_count = 0
    total_satisfaction = 0.0

    for index, room_id in enumerate(sorted(room_assignments)):
        room_eval = _evaluate_room(room_assignments[room_id], pair_results)
        if index == 0:
            minimum_satisfaction = room_eval.minimum_satisfaction
        else:
            minimum_satisfaction = min(minimum_satisfaction, room_eval.minimum_satisfaction)
        poor_count += room_eval.poor_count
        total_satisfaction += room_eval.total_satisfaction
        labels_by_student.update(room_eval.labels_by_student)

    return _StateEvaluation(
        minimum_satisfaction=minimum_satisfaction,
        poor_count=poor_count,
        total_satisfaction=total_satisfaction,
        labels_by_student=labels_by_student,
    )


def _state_signature(room_assignments: dict[str, list[str]]) -> tuple[tuple[str, tuple[str, ...]], ...]:
    return tuple(
        (room_id, tuple(sorted(room_assignments[room_id])))
        for room_id in sorted(room_assignments)
    )


def _creates_new_poor(
    before_labels: dict[str, SatisfactionLabel],
    after_labels: dict[str, SatisfactionLabel],
) -> bool:
    for student_id, before_label in before_labels.items():
        after_label = after_labels[student_id]
        if before_label != "Poor" and after_label == "Poor":
            return True
    return False


def _is_better_candidate(
    candidate_eval: _StateEvaluation,
    best_eval: _StateEvaluation,
    candidate_signature: tuple[str, str, str, str],
    best_signature: tuple[str, str, str, str],
) -> bool:
    if candidate_eval.minimum_satisfaction > best_eval.minimum_satisfaction + EPSILON:
        return True
    if best_eval.minimum_satisfaction > candidate_eval.minimum_satisfaction + EPSILON:
        return False

    if candidate_eval.poor_count < best_eval.poor_count:
        return True
    if candidate_eval.poor_count > best_eval.poor_count:
        return False

    if candidate_eval.total_satisfaction > best_eval.total_satisfaction + EPSILON:
        return True
    if best_eval.total_satisfaction > candidate_eval.total_satisfaction + EPSILON:
        return False

    return candidate_signature < best_signature


def optimize_swaps(
    room_assignments: dict[str, list[str]],
    pair_results: dict[tuple[str, str], PairResult],
    max_passes: int = 3,
) -> tuple[dict[str, list[str]], int]:
    current_state: dict[str, list[str]] = {
        room_id: sorted(students)
        for room_id, students in room_assignments.items()
    }

    passes_applied = 0
    seen_signatures: set[tuple[tuple[str, tuple[str, ...]], ...]] = set()

    for _ in range(max_passes):
        signature = _state_signature(current_state)
        if signature in seen_signatures:
            break
        seen_signatures.add(signature)

        baseline_rooms = {
            room_id: _evaluate_room(students, pair_results)
            for room_id, students in current_state.items()
        }
        baseline_eval = _StateEvaluation(
            minimum_satisfaction=min(
                (room.minimum_satisfaction for room in baseline_rooms.values()),
                default=0.0,
            ),
            poor_count=sum(room.poor_count for room in baseline_rooms.values()),
            total_satisfaction=sum(room.total_satisfaction for room in baseline_rooms.values()),
            labels_by_student={
                student_id: label
                for room in baseline_rooms.values()
                for student_id, label in room.labels_by_student.items()
            },
        )

        best_state: dict[str, list[str]] | None = None
        best_eval: _StateEvaluation | None = None
        best_signature: tuple[str, str, str, str] | None = None

        room_ids = sorted(current_state)
        for index_a in range(len(room_ids)):
            for index_b in range(index_a + 1, len(room_ids)):
                room_a = room_ids[index_a]
                room_b = room_ids[index_b]

                students_a = baseline_rooms[room_a].labels_by_student
                students_b = baseline_rooms[room_b].labels_by_student
                other_rooms_min = min(
                    (
                        room.minimum_satisfaction
                        for room_id, room in baseline_rooms.items()
                        if room_id not in (room_a, room_b)
                    ),
                    default=float("inf"),
                )

                for student_a in sorted(students_a):
                    for student_b in sorted(students_b):
                        candidate_a = sorted(
                            student_b if student == student_a else student
                            for student in current_state[room_a]
                        )
                        candidate_b = sorted(
                            student_a if student == student_b else student
                            for student in current_state[room_b]
                        )

                        eval_a = _evaluate_room(candidate_a, pair_results)
                        eval_b = _evaluate_room(candidate_b, pair_results)

                        candidate_eval = _StateEvaluation(
                            minimum_satisfaction=min(
                                eval_a.minimum_satisfaction,
                                eval_b.minimum_satisfaction,
                                other_rooms_min,
                            ),
                            poor_count=(
                                baseline_eval.poor_count
                                - baseline_rooms[room_a].poor_count
                                - baseline_rooms[room_b].poor_count
                                + eval_a.poor_count
                                + eval_b.poor_count
                            ),
                            total_satisfaction=(
                                baseline_eval.total_satisfaction
                                - baseline_rooms[room_a].total_satisfaction
                                - baseline_rooms[room_b].total_satisfaction
                                + eval_a.total_satisfaction
                                + eval_b.total_satisfaction
                            ),
                            labels_by_student={
                                **eval_a.labels_by_student,
                                **eval_b.labels_by_student,
                            },
                        )

                        if candidate_eval.minimum_satisfaction <= baseline_eval.minimum_satisfaction + EPSILON:
                            continue

                        if _creates_new_poor(
                            {
                                student_id: baseline_eval.labels_by_student[student_id]
                                for student_id in candidate_eval.labels_by_student
                            },
                            candidate_eval.labels_by_student,
                        ):
                            continue

                        candidate_signature = (room_a, student_a, room_b, student_b)
                        if best_state is None or best_eval is None or best_signature is None:
                            best_state = {
                                **current_state,
                                room_a: candidate_a,
                                room_b: candidate_b,
                            }
                            best_eval = candidate_eval
                            best_signature = candidate_signature
                            continue

                        if _is_better_candidate(candidate_eval, best_eval, candidate_signature, best_signature):
                            best_state = {
                                **current_state,
                                room_a: candidate_a,
                                room_b: candidate_b,
                            }
                            best_eval = candidate_eval
                            best_signature = candidate_signature

        if best_state is None:
            break

        current_state = best_state
        passes_applied += 1

    return current_state, passes_applied
