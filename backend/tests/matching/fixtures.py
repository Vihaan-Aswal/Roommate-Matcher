from __future__ import annotations

from itertools import combinations

from app.services.matching.contracts import SegmentData
from app.services.scoring.types import FactorScore, PairResult


def canonical_key(student_a: str, student_b: str) -> tuple[str, str]:
    return (student_a, student_b) if student_a < student_b else (student_b, student_a)


def make_pair_result(score: float, *, excellent: bool | None = None) -> PairResult:
    if excellent is None:
        excellent = score >= 0.90
    return PairResult(
        pair_score=score,
        factor_breakdown={
            "q1_enc": FactorScore(raw_score=score, weight_used=1.0, missing_data=False),
        },
        excellent_candidate=excellent,
    )


def build_pair_results(
    student_ids: list[str],
    *,
    default_score: float,
    score_overrides: dict[tuple[str, str], float] | None = None,
    excellent_overrides: dict[tuple[str, str], bool] | None = None,
) -> dict[tuple[str, str], PairResult]:
    normalized_scores = {
        canonical_key(student_a, student_b): score
        for (student_a, student_b), score in (score_overrides or {}).items()
    }
    normalized_excellent = {
        canonical_key(student_a, student_b): excellent
        for (student_a, student_b), excellent in (excellent_overrides or {}).items()
    }

    result: dict[tuple[str, str], PairResult] = {}
    for student_a, student_b in combinations(sorted(student_ids), 2):
        key = canonical_key(student_a, student_b)
        score = normalized_scores.get(key, default_score)
        excellent = normalized_excellent.get(key)
        result[key] = make_pair_result(score, excellent=excellent)

    return result


def clean_2bed_clear_optimum() -> SegmentData:
    students = [f"S{i:02d}" for i in range(1, 9)]
    overrides = {
        ("S01", "S02"): 0.97,
        ("S03", "S04"): 0.96,
        ("S05", "S06"): 0.95,
        ("S07", "S08"): 0.94,
    }
    pair_results = build_pair_results(students, default_score=0.20, score_overrides=overrides)
    return SegmentData(
        segment_key="SEG_2BED_CLEAR",
        room_size=2,
        student_ids=students,
        room_ids=None,
        pair_results=pair_results,
        metadata={"fixture": "clean_2bed_clear_optimum"},
    )


def three_bed_leftover_solo() -> SegmentData:
    students = [f"T{i:02d}" for i in range(1, 10)]
    high_triads = {
        ("T01", "T02"): 0.93,
        ("T01", "T03"): 0.92,
        ("T02", "T03"): 0.91,
        ("T04", "T05"): 0.93,
        ("T04", "T06"): 0.92,
        ("T05", "T06"): 0.91,
        ("T07", "T08"): 0.93,
        ("T07", "T09"): 0.92,
        ("T08", "T09"): 0.91,
    }
    pair_results = build_pair_results(students, default_score=0.25, score_overrides=high_triads)
    return SegmentData(
        segment_key="SEG_3BED_LEFTOVER",
        room_size=3,
        student_ids=students,
        room_ids=None,
        pair_results=pair_results,
        metadata={"fixture": "three_bed_leftover_solo"},
    )


def four_bed_ambiguous_pair_merges() -> SegmentData:
    students = [f"F{i:02d}" for i in range(1, 9)]
    overrides: dict[tuple[str, str], float] = {
        ("F01", "F02"): 0.96,
        ("F03", "F04"): 0.96,
        ("F05", "F06"): 0.96,
        ("F07", "F08"): 0.96,
    }

    for left in ("F01", "F02"):
        for right in ("F03", "F04"):
            overrides[(left, right)] = 0.80
    for left in ("F01", "F02"):
        for right in ("F05", "F06"):
            overrides[(left, right)] = 0.80

    for left in ("F03", "F04"):
        for right in ("F07", "F08"):
            overrides[(left, right)] = 0.79
    for left in ("F05", "F06"):
        for right in ("F07", "F08"):
            overrides[(left, right)] = 0.79

    pair_results = build_pair_results(students, default_score=0.30, score_overrides=overrides)
    return SegmentData(
        segment_key="SEG_4BED_AMBIG",
        room_size=4,
        student_ids=students,
        room_ids=None,
        pair_results=pair_results,
        metadata={"fixture": "four_bed_ambiguous_pair_merges"},
    )


def adversarial_swap_improves_minimum() -> SegmentData:
    students = [f"A{i:02d}" for i in range(1, 13)]
    strong_groups = {
        ("A01", "A02"): 0.90,
        ("A01", "A03"): 0.88,
        ("A02", "A03"): 0.89,
        ("A04", "A05"): 0.90,
        ("A04", "A06"): 0.88,
        ("A05", "A06"): 0.89,
        ("A07", "A08"): 0.90,
        ("A07", "A09"): 0.88,
        ("A08", "A09"): 0.89,
        ("A10", "A11"): 0.90,
        ("A10", "A12"): 0.88,
        ("A11", "A12"): 0.89,
    }
    pair_results = build_pair_results(students, default_score=0.35, score_overrides=strong_groups)
    return SegmentData(
        segment_key="SEG_SWAP_ADV",
        room_size=3,
        student_ids=students,
        room_ids=None,
        pair_results=pair_results,
        metadata={"fixture": "adversarial_swap_improves_minimum"},
    )


def uniformly_weak_segment() -> SegmentData:
    students = [f"W{i:02d}" for i in range(1, 7)]
    pair_results = build_pair_results(students, default_score=0.42)
    return SegmentData(
        segment_key="SEG_WEAK",
        room_size=2,
        student_ids=students,
        room_ids=None,
        pair_results=pair_results,
        metadata={"fixture": "uniformly_weak_segment"},
    )


def determinism_tie_pressure() -> SegmentData:
    students = [f"D{i:02d}" for i in range(1, 11)]
    pair_results = build_pair_results(students, default_score=0.75)
    return SegmentData(
        segment_key="SEG_TIE_PRESSURE",
        room_size=2,
        student_ids=students,
        room_ids=None,
        pair_results=pair_results,
        metadata={"fixture": "determinism_tie_pressure"},
    )
