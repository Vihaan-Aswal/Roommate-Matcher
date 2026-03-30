from __future__ import annotations

from collections.abc import Sequence
from itertools import combinations

from app.services.scoring.pipeline import compute_pair_score
from app.services.scoring.types import PairResult, ScoringProfile


def compute_segment_pair_scores(profiles: Sequence[ScoringProfile]) -> dict[tuple[str, str], PairResult]:
    ordered_profiles = sorted(profiles, key=lambda profile: profile.admission_number)

    pair_scores: dict[tuple[str, str], PairResult] = {}
    for profile_a, profile_b in combinations(ordered_profiles, 2):
        edge = (profile_a.admission_number, profile_b.admission_number)
        pair_scores[edge] = compute_pair_score(profile_a, profile_b)

    return pair_scores
