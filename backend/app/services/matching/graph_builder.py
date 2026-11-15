from __future__ import annotations

from itertools import combinations

import networkx as nx

from app.services.matching.pair_lookup import get_pair_result
from app.services.scoring.types import PairResult

# NetworkX blossom slows down by >300x when every edge has a distinct
# near-tied weight (200 students: 0.07 s equal vs 25 s perturbed). Ties are
# therefore left equal and resolved deterministically by the sorted graph
# insertion order; the tie_rank attribute is retained for audit only.
def _effective_weight(pair_score: float, tie_rank: int) -> float:
    return pair_score


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
            weight=_effective_weight(pair_result.pair_score, tie_rank=tie_rank),
            pair_score=pair_result.pair_score,
            pair_result=pair_result,
            tie_rank=tie_rank,
        )

    return graph
