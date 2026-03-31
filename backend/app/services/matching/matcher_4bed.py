from __future__ import annotations

from itertools import combinations
from statistics import fmean

from app.services.matching.errors import MatchingConstructionError, SegmentValidationError
from app.services.matching.matcher_2bed import match_2bed
from app.services.matching.pair_lookup import get_pair_result
from app.services.scoring.types import PairResult


def _merge_stats(
    pair_a: tuple[str, str],
    pair_b: tuple[str, str],
    pair_results: dict[tuple[str, str], PairResult],
) -> tuple[float, float, tuple[str, str, str, str]]:
    students = tuple(sorted((*pair_a, *pair_b)))
    six_pair_scores = [
        get_pair_result(pair_results, student_a, student_b).pair_score
        for student_a, student_b in combinations(students, 2)
    ]
    return fmean(six_pair_scores), min(six_pair_scores), students


def match_4bed(
    student_ids: list[str],
    pair_results: dict[tuple[str, str], PairResult],
) -> list[list[str]]:
    ordered_students = sorted(student_ids)
    if len(ordered_students) % 4 != 0:
        raise SegmentValidationError("4-bed matching requires student count divisible by 4")

    initial_pairs = [tuple(pair) for pair in match_2bed(ordered_students, pair_results)]
    pending_pairs = sorted(initial_pairs)
    rooms: list[list[str]] = []

    while pending_pairs:
        base_pair = pending_pairs.pop(0)
        if not pending_pairs:
            raise MatchingConstructionError("4-bed matcher cannot merge final pair")

        ranked_candidates = []
        for candidate_pair in pending_pairs:
            merge_average, merge_minimum, merge_key = _merge_stats(base_pair, candidate_pair, pair_results)
            ranked_candidates.append((-merge_average, -merge_minimum, merge_key, candidate_pair))

        ranked_candidates.sort()
        best_partner = ranked_candidates[0][3]
        pending_pairs.remove(best_partner)

        room_students = sorted((*base_pair, *best_partner))
        if len(set(room_students)) != 4:
            raise MatchingConstructionError("4-bed matcher produced duplicate student in room")
        rooms.append(room_students)

    expected_room_count = len(ordered_students) // 4
    if len(rooms) != expected_room_count:
        raise MatchingConstructionError(
            f"4-bed matcher returned {len(rooms)} rooms, expected {expected_room_count}"
        )

    assigned = sorted(student for room in rooms for student in room)
    if assigned != ordered_students:
        raise MatchingConstructionError("4-bed matcher did not assign each student exactly once")

    rooms.sort()
    return rooms
