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


def _evaluate_state(
    room_assignments: dict[str, list[str]],
    pair_results: dict[tuple[str, str], PairResult],
) -> _StateEvaluation:
    labels_by_student: dict[str, SatisfactionLabel] = {}
    all_scores: list[float] = []

    for room_id in sorted(room_assignments):
        room_students = sorted(room_assignments[room_id])
        satisfaction_scores = compute_student_satisfaction_scores(room_students, pair_results)

        for student_id in room_students:
            roommates = [roommate for roommate in room_students if roommate != student_id]
            score = satisfaction_scores[student_id]
            label, _, _ = classify_student(student_id, roommates, score, pair_results)
            labels_by_student[student_id] = label
            all_scores.append(score)

    minimum_satisfaction = min(all_scores) if all_scores else 0.0
    poor_count = sum(1 for label in labels_by_student.values() if label == "Poor")
    total_satisfaction = sum(all_scores)

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

        baseline_eval = _evaluate_state(current_state, pair_results)
        best_state: dict[str, list[str]] | None = None
        best_eval: _StateEvaluation | None = None
        best_signature: tuple[str, str, str, str] | None = None

        room_ids = sorted(current_state)
        for index_a in range(len(room_ids)):
            for index_b in range(index_a + 1, len(room_ids)):
                room_a = room_ids[index_a]
                room_b = room_ids[index_b]

                students_a = sorted(current_state[room_a])
                students_b = sorted(current_state[room_b])

                for student_a in students_a:
                    for student_b in students_b:
                        candidate_state = {
                            room_id: sorted(students)
                            for room_id, students in current_state.items()
                        }

                        idx_a = candidate_state[room_a].index(student_a)
                        idx_b = candidate_state[room_b].index(student_b)
                        candidate_state[room_a][idx_a] = student_b
                        candidate_state[room_b][idx_b] = student_a
                        candidate_state[room_a].sort()
                        candidate_state[room_b].sort()

                        candidate_eval = _evaluate_state(candidate_state, pair_results)
                        if candidate_eval.minimum_satisfaction <= baseline_eval.minimum_satisfaction + EPSILON:
                            continue

                        if _creates_new_poor(baseline_eval.labels_by_student, candidate_eval.labels_by_student):
                            continue

                        candidate_signature = (room_a, student_a, room_b, student_b)
                        if best_state is None or best_eval is None or best_signature is None:
                            best_state = candidate_state
                            best_eval = candidate_eval
                            best_signature = candidate_signature
                            continue

                        if _is_better_candidate(candidate_eval, best_eval, candidate_signature, best_signature):
                            best_state = candidate_state
                            best_eval = candidate_eval
                            best_signature = candidate_signature

        if best_state is None:
            break

        current_state = best_state
        passes_applied += 1

    return current_state, passes_applied
