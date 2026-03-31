from __future__ import annotations

import pytest

from app.services.matching.errors import InvalidMatchingOutputError
from app.services.matching.nx_mapping import map_blossom_matching


def test_map_blossom_matching_maps_to_canonical_ordered_pairs() -> None:
    raw_matching = {
        frozenset(("ADM002", "ADM001")),
        frozenset(("ADM004", "ADM003")),
    }

    result = map_blossom_matching(raw_matching)

    assert result == [("ADM001", "ADM002"), ("ADM003", "ADM004")]


def test_map_blossom_matching_rejects_malformed_items() -> None:
    raw_matching = [frozenset(("ADM001",))]

    with pytest.raises(InvalidMatchingOutputError):
        map_blossom_matching(raw_matching)


def test_map_blossom_matching_rejects_duplicate_student_across_pairs() -> None:
    raw_matching = [
        frozenset(("ADM001", "ADM002")),
        frozenset(("ADM001", "ADM003")),
    ]

    with pytest.raises(InvalidMatchingOutputError):
        map_blossom_matching(raw_matching)


def test_map_blossom_matching_order_is_deterministic() -> None:
    raw_matching = [
        frozenset(("ADM010", "ADM009")),
        frozenset(("ADM002", "ADM001")),
    ]

    result = map_blossom_matching(raw_matching)

    assert result == [("ADM001", "ADM002"), ("ADM009", "ADM010")]
