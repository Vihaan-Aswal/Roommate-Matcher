"""Benchmark the matching engine and the persisted run workflow.

Usage (from backend/):
    uv run --extra dev python scripts/benchmark_matching.py
    uv run --extra dev python scripts/benchmark_matching.py --students 200 --rooms 100

Prints wall-clock milliseconds for 3 runs of each scenario. No network, no server.
"""
from __future__ import annotations

import argparse
import statistics
import time

from app.services.matching.contracts import SegmentData
from app.services.matching.engine import run_matching_for_segment
from app.services.scoring.pipeline import compute_pair_score
from app.services.scoring.types import ScoringProfile
from itertools import combinations


def _profile(student_id: str) -> ScoringProfile:
    return ScoringProfile(
        admission_number=student_id,
        has_preferences=True,
        q1_enc=0,
        q2_enc=0,
        q3_enc=0,
        q4a_enc=0,
        q4b_enc=3,
        q5a_enc=0,
        q5b_enc=3,
        q6_enc=1,
        q7_enc=1,
        q8_enc=1,
        q9_enc=0,
        q10_enc=3,
    )


def _segment(student_count: int, room_size: int) -> SegmentData:
    ids = [f"P{i:04d}" for i in range(1, student_count + 1)]
    profiles = {sid: _profile(sid) for sid in ids}
    pair_results = {
        (a, b): compute_pair_score(profiles[a], profiles[b])
        for a, b in combinations(ids, 2)
    }
    return SegmentData(
        segment_key=f"SEG_{student_count}_{room_size}",
        room_size=room_size,
        student_ids=ids,
        pair_results=pair_results,
        room_ids=None,
        metadata={"benchmark": True},
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--students", type=int, default=200)
    parser.add_argument("--room-size", type=int, default=2)
    parser.add_argument("--iterations", type=int, default=3)
    args = parser.parse_args()

    segment = _segment(args.students, args.room_size)
    timings: list[float] = []
    result = None
    for _ in range(args.iterations):
        started = time.perf_counter()
        result = run_matching_for_segment(segment)
        timings.append((time.perf_counter() - started) * 1000)

    assert result is not None
    print(
        {
            "students": args.students,
            "room_size": args.room_size,
            "rooms": len(result.rooms),
            "iterations_ms": [round(value, 2) for value in timings],
            "median_ms": round(statistics.median(timings), 2),
            "min_ms": round(min(timings), 2),
            "max_ms": round(max(timings), 2),
            "swap_passes": result.swap_passes_applied,
        }
    )


if __name__ == "__main__":
    main()
