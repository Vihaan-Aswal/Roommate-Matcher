from __future__ import annotations

from collections.abc import Iterable

from app.services.matching.errors import InvalidMatchingOutputError
from app.services.matching.pair_lookup import canonical_pair


def map_blossom_matching(raw_matching: Iterable[object]) -> list[tuple[str, str]]:
    mapped_pairs: list[tuple[str, str]] = []
    used_students: set[str] = set()

    for item in raw_matching:
        if isinstance(item, (set, frozenset, list, tuple)):
            values = list(item)
        else:
            raise InvalidMatchingOutputError(f"Invalid matching item type: {type(item)!r}")

        if len(values) != 2:
            raise InvalidMatchingOutputError(f"Matching item must contain exactly 2 students: {item!r}")

        student_a, student_b = values
        if not isinstance(student_a, str) or not isinstance(student_b, str):
            raise InvalidMatchingOutputError(f"Matching item students must be strings: {item!r}")

        pair = canonical_pair(student_a, student_b)

        if pair[0] in used_students or pair[1] in used_students:
            raise InvalidMatchingOutputError(f"Student appears in more than one pair: {pair!r}")

        used_students.add(pair[0])
        used_students.add(pair[1])
        mapped_pairs.append(pair)

    mapped_pairs.sort()
    return mapped_pairs
