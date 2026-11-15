from __future__ import annotations

import networkx as nx

from app.services.matching.errors import MatchingConstructionError, SegmentValidationError
from app.services.matching.graph_builder import build_complete_graph
from app.services.matching.nx_mapping import map_blossom_matching
from app.services.matching.pair_lookup import get_pair_result
from app.services.scoring.types import PairResult


def _canonicalize_ties(
    pairs: list[tuple[str, str]],
    pair_results: dict[tuple[str, str], PairResult],
) -> list[tuple[str, str]]:
    """Within a group of exactly equal scores, choose the lexicographically smallest pairs.

    NetworkX treats equal weights as interchangeable; this pass makes the tie rule
    explicit and stable without giving every edge a distinct weight (which made
    blossom ~300x slower on large complete graphs).
    """
    canonical = True
    while canonical:
        canonical = False
        for first in range(len(pairs)):
            for second in range(first + 1, len(pairs)):
                a, b = pairs[first]
                c, d = pairs[second]
                if len({a, b, c, d}) != 4:
                    continue
                current = sorted([tuple(sorted((a, b))), tuple(sorted((c, d)))])
                alternatives = [
                    sorted([tuple(sorted((a, c))), tuple(sorted((b, d)))]),
                    sorted([tuple(sorted((a, d))), tuple(sorted((b, c)))]),
                ]
                current_scores = [get_pair_result(pair_results, x, y).pair_score for x, y in current]
                if len(set(current_scores)) != 1:
                    continue
                for alternative in alternatives:
                    alternative_scores = [
                        get_pair_result(pair_results, x, y).pair_score for x, y in alternative
                    ]
                    if alternative_scores == current_scores and alternative < current:
                        pairs[first], pairs[second] = alternative
                        canonical = True
                        break
                if canonical:
                    break
            if canonical:
                break
    return pairs


def match_2bed(
    student_ids: list[str],
    pair_results: dict[tuple[str, str], PairResult],
) -> list[list[str]]:
    ordered_students = sorted(student_ids)
    if len(ordered_students) % 2 != 0:
        raise SegmentValidationError("2-bed matching requires an even student count")

    graph = build_complete_graph(ordered_students, pair_results)
    raw_matching = nx.max_weight_matching(graph, maxcardinality=True, weight="weight")
    pairs = map_blossom_matching(raw_matching)

    expected_pair_count = len(ordered_students) // 2
    if len(pairs) != expected_pair_count:
        raise MatchingConstructionError(
            f"2-bed matcher returned {len(pairs)} pairs, expected {expected_pair_count}"
        )

    assigned = sorted(student for pair in pairs for student in pair)
    if assigned != ordered_students:
        raise MatchingConstructionError("2-bed matcher did not assign each student exactly once")

    pairs = _canonicalize_ties(list(pairs), pair_results)

    return [list(pair) for pair in pairs]
