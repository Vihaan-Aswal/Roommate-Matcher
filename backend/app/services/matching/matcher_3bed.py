from __future__ import annotations

from statistics import fmean

import networkx as nx

from app.services.matching.errors import MatchingConstructionError, SegmentValidationError
from app.services.matching.graph_builder import build_complete_graph
from app.services.matching.nx_mapping import map_blossom_matching
from app.services.matching.pair_lookup import get_pair_result
from app.services.scoring.types import PairResult

GOOD_OPTION_THRESHOLD = 0.70


def _candidate_stats(
    candidate: str,
    unit_members: list[str],
    pair_results: dict[tuple[str, str], PairResult],
) -> tuple[float, float]:
    scores = [get_pair_result(pair_results, candidate, member).pair_score for member in unit_members]
    return fmean(scores), min(scores)


def _best_candidate(
    unit_members: list[str],
    candidate_pool: list[str],
    pair_results: dict[tuple[str, str], PairResult],
) -> str | None:
    if not candidate_pool:
        return None

    ranked = []
    for candidate in candidate_pool:
        avg_score, min_edge = _candidate_stats(candidate, unit_members, pair_results)
        ranked.append((-avg_score, -min_edge, candidate))

    ranked.sort()
    return ranked[0][2]


def _unit_priority(
    unit_members: tuple[str, ...],
    available: set[str],
    pair_results: dict[tuple[str, str], PairResult],
) -> tuple[int, float, tuple[str, ...]]:
    candidate_pool = sorted(available.difference(unit_members))
    required = 3 - len(unit_members)
    if len(candidate_pool) < required:
        return (10**9, 10.0, unit_members)

    avg_scores = [
        _candidate_stats(candidate, list(unit_members), pair_results)[0]
        for candidate in candidate_pool
    ]
    good_options = sum(1 for score in avg_scores if score >= GOOD_OPTION_THRESHOLD)
    best_achievable = max(avg_scores) if avg_scores else 0.0

    # Lower good-options and lower best-achievable are processed first.
    return (good_options, best_achievable, unit_members)


def match_3bed(
    student_ids: list[str],
    pair_results: dict[tuple[str, str], PairResult],
) -> list[list[str]]:
    ordered_students = sorted(student_ids)
    if len(ordered_students) % 3 != 0:
        raise SegmentValidationError("3-bed matching requires student count divisible by 3")

    graph = build_complete_graph(ordered_students, pair_results)
    raw_matching = nx.max_weight_matching(graph, maxcardinality=True, weight="weight")
    initial_pairs = map_blossom_matching(raw_matching)

    matched_students = {student for pair in initial_pairs for student in pair}
    leftover = sorted(set(ordered_students).difference(matched_students))
    if len(leftover) > 1:
        raise MatchingConstructionError("3-bed matcher produced more than one leftover student")

    seed_units: list[tuple[str, ...]] = [tuple(pair) for pair in initial_pairs]
    if leftover:
        seed_units.append((leftover[0],))

    available = set(ordered_students)
    rooms: list[list[str]] = []

    while available:
        pending_units = [unit for unit in seed_units if all(member in available for member in unit)]
        if pending_units:
            pending_units.sort(key=lambda unit: _unit_priority(unit, available, pair_results))
            building_room = list(pending_units[0])
        else:
            # Fallback preserves completion in edge cases where all original seed units were partially consumed.
            building_room = [min(available)]

        while len(building_room) < 3:
            candidate_pool = sorted(available.difference(building_room))
            candidate = _best_candidate(building_room, candidate_pool, pair_results)
            if candidate is None:
                raise MatchingConstructionError("Unable to complete a 3-bed room")
            building_room.append(candidate)

        room = sorted(building_room)
        for student in room:
            if student not in available:
                raise MatchingConstructionError("Duplicate assignment detected while building 3-bed rooms")
        for student in room:
            available.remove(student)

        rooms.append(room)

    expected_room_count = len(ordered_students) // 3
    if len(rooms) != expected_room_count:
        raise MatchingConstructionError(
            f"3-bed matcher returned {len(rooms)} rooms, expected {expected_room_count}"
        )

    assigned = sorted(student for room in rooms for student in room)
    if assigned != ordered_students:
        raise MatchingConstructionError("3-bed matcher did not assign each student exactly once")

    rooms.sort()
    return rooms
