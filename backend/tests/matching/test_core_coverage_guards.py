from __future__ import annotations

import pytest

from app.services.matching import matcher_3bed, matcher_4bed
from app.services.matching.errors import MatchingConstructionError
from app.services.matching.matcher_3bed import match_3bed
from app.services.matching.matcher_4bed import match_4bed
from tests.matching.fixtures import build_pair_results


def test_match_3bed_rejects_a_collaborator_that_returns_an_unavailable_student(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    students = ["A", "B", "C"]
    pair_results = build_pair_results(students, default_score=0.6)
    monkeypatch.setattr(matcher_3bed, "_best_candidate", lambda *args, **kwargs: "GHOST")

    with pytest.raises(MatchingConstructionError, match="Duplicate assignment detected"):
        match_3bed(students, pair_results)


def test_match_4bed_rejects_a_collaborator_that_overlaps_pairs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    students = ["A", "B", "C", "D"]
    pair_results = build_pair_results(students, default_score=0.6)
    monkeypatch.setattr(
        matcher_4bed,
        "match_2bed",
        lambda *args, **kwargs: [["A", "B"], ["B", "C"]],
    )
    monkeypatch.setattr(
        matcher_4bed,
        "_merge_stats",
        lambda *_args, **_kwargs: (0.5, 0.5, ("A", "B", "B", "C")),
    )

    with pytest.raises(MatchingConstructionError, match="duplicate student in room"):
        match_4bed(students, pair_results)
