from __future__ import annotations

from itertools import combinations
from statistics import fmean

from app.services.matching.pair_lookup import get_pair_result
from app.services.scoring.types import PairResult


def compute_group_score(
    room_students: list[str],
    pair_results: dict[tuple[str, str], PairResult],
) -> float:
    if len(room_students) < 2:
        return 0.0

    pair_scores = [
        get_pair_result(pair_results, student_a, student_b).pair_score
        for student_a, student_b in combinations(sorted(room_students), 2)
    ]
    return fmean(pair_scores)


def compute_student_satisfaction_scores(
    room_students: list[str],
    pair_results: dict[tuple[str, str], PairResult],
) -> dict[str, float]:
    sorted_room = sorted(room_students)
    scores: dict[str, float] = {}

    for student in sorted_room:
        roommates = [roommate for roommate in sorted_room if roommate != student]
        if not roommates:
            scores[student] = 0.0
            continue

        roommate_scores = [
            get_pair_result(pair_results, student, roommate).pair_score
            for roommate in roommates
        ]
        scores[student] = fmean(roommate_scores)

    return scores
