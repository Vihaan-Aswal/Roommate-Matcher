from __future__ import annotations

import networkx as nx

from app.services.matching.errors import MatchingConstructionError, SegmentValidationError
from app.services.matching.graph_builder import build_complete_graph
from app.services.matching.nx_mapping import map_blossom_matching
from app.services.scoring.types import PairResult


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

    return [list(pair) for pair in pairs]
