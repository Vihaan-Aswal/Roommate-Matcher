from __future__ import annotations

from collections.abc import Iterable
from itertools import combinations

from app.services.matching.errors import IncompletePairMatrixError, InvalidPairMatrixError, SegmentValidationError
from app.services.scoring.types import PairResult


def canonical_pair(student_a: str, student_b: str) -> tuple[str, str]:
    if student_a == student_b:
        raise InvalidPairMatrixError(f"Self edge is not allowed: {student_a}")
    return (student_a, student_b) if student_a < student_b else (student_b, student_a)


def get_pair_result(pair_results: dict[tuple[str, str], PairResult], student_a: str, student_b: str) -> PairResult:
    key = canonical_pair(student_a, student_b)
    result = pair_results.get(key)
    if result is None:
        raise IncompletePairMatrixError([key])
    return result


def expected_pair_keys(student_ids: Iterable[str]) -> list[tuple[str, str]]:
    ordered_students = sorted(student_ids)
    return [canonical_pair(a, b) for a, b in combinations(ordered_students, 2)]


def normalize_and_validate_pair_results(
    student_ids: list[str],
    pair_results: dict[tuple[str, str], PairResult],
) -> dict[tuple[str, str], PairResult]:
    ordered_students = sorted(student_ids)
    if not ordered_students:
        raise SegmentValidationError("student_ids must be non-empty")

    if len(set(ordered_students)) != len(ordered_students):
        raise SegmentValidationError("student_ids must be unique")

    student_set = set(ordered_students)
    normalized: dict[tuple[str, str], PairResult] = {}

    for raw_key, pair_result in pair_results.items():
        if not isinstance(raw_key, tuple) or len(raw_key) != 2:
            raise InvalidPairMatrixError(f"Invalid pair key shape: {raw_key!r}")

        student_a, student_b = raw_key
        if student_a not in student_set or student_b not in student_set:
            raise InvalidPairMatrixError(f"Unknown student in pair key: {raw_key!r}")

        canonical = canonical_pair(student_a, student_b)
        if canonical in normalized:
            raise InvalidPairMatrixError(f"Duplicate pair edge detected: {canonical!r}")

        if pair_result.pair_score < 0.0 or pair_result.pair_score > 1.0:
            raise InvalidPairMatrixError(
                f"Pair score out of range for edge {canonical!r}: {pair_result.pair_score}"
            )

        normalized[canonical] = pair_result

    expected_keys = set(expected_pair_keys(ordered_students))
    missing = sorted(expected_keys.difference(normalized.keys()))
    if missing:
        raise IncompletePairMatrixError(missing)

    return normalized
