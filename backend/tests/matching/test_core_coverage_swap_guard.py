from __future__ import annotations

import pytest

from app.services.matching import swap_optimizer
from app.services.matching.pair_lookup import normalize_and_validate_pair_results
from app.services.matching.swap_optimizer import optimize_swaps
from tests.matching.fixtures import build_pair_results


def test_optimize_swaps_stops_when_a_state_signature_repeats(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    students = ["A", "B", "C", "D"]
    pair_results = normalize_and_validate_pair_results(
        students,
        build_pair_results(
            students,
            default_score=0.3,
            score_overrides={
                ("A", "B"): 0.2,
                ("C", "D"): 0.8,
                ("A", "C"): 0.9,
                ("B", "D"): 0.9,
                ("A", "D"): 0.3,
                ("B", "C"): 0.3,
            },
        ),
    )
    monkeypatch.setattr(
        swap_optimizer,
        "_state_signature",
        lambda _rooms: (("R1", ("A", "B")), ("R2", ("C", "D"))),
    )

    optimized, passes = optimize_swaps({"R1": ["A", "B"], "R2": ["C", "D"]}, pair_results)

    # One improving swap is applied; the repeated signature then stops pass 2.
    assert passes == 1
    assert optimized != {"R1": ["A", "B"], "R2": ["C", "D"]}
