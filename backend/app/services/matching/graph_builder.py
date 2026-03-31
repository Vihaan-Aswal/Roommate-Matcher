from __future__ import annotations

from itertools import combinations

import networkx as nx

from app.services.matching.pair_lookup import get_pair_result
from app.services.scoring.types import PairResult

SCORE_SCALE = 1_000_000_000


def _effective_weight(pair_score: float, tie_rank: int, edge_count: int) -> int:
    scaled = int(round(pair_score * SCORE_SCALE))
    return (scaled * (edge_count + 1)) + tie_rank


def build_complete_graph(
    student_ids: list[str],
    pair_results: dict[tuple[str, str], PairResult],
) -> nx.Graph:
    ordered_students = sorted(student_ids)
    edge_keys = list(combinations(ordered_students, 2))
    edge_count = len(edge_keys)

    graph = nx.Graph()
    graph.add_nodes_from(ordered_students)

    # Higher tie rank is assigned to lexicographically smaller keys.
    for index, (student_a, student_b) in enumerate(edge_keys):
        pair_result = get_pair_result(pair_results, student_a, student_b)
        tie_rank = edge_count - index
        graph.add_edge(
            student_a,
            student_b,
            weight=_effective_weight(pair_result.pair_score, tie_rank=tie_rank, edge_count=edge_count),
            pair_score=pair_result.pair_score,
            pair_result=pair_result,
            tie_rank=tie_rank,
        )

    return graph
