from __future__ import annotations

import time

from app.services.matching.contracts import SegmentData
from app.services.matching.engine import run_matching_for_segment
from tests.matching.fixtures import build_pair_results


def test_performance_smoke_50_student_2bed_under_2_seconds() -> None:
    students = [f"P{i:03d}" for i in range(1, 51)]
    pair_results = build_pair_results(students, default_score=0.55)

    segment = SegmentData(
        segment_key="SEG_PERF_50",
        room_size=2,
        student_ids=students,
        room_ids=None,
        pair_results=pair_results,
        metadata={"fixture": "performance_smoke"},
    )

    started_at = time.perf_counter()
    result = run_matching_for_segment(segment)
    elapsed = time.perf_counter() - started_at

    assert len(result.rooms) == 25
    assert elapsed < 2.0
