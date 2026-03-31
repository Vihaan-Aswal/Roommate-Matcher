from __future__ import annotations

from app.services.fairness.contracts import FairnessReport, LABEL_ORDER, SegmentFairnessSummary


def test_label_order_is_fixed() -> None:
    assert LABEL_ORDER == ("Excellent", "Good", "Okay", "Poor")


def test_fairness_report_shape_is_stable() -> None:
    summary = SegmentFairnessSummary(
        segment_key="SEG_A",
        total_students=4,
        label_counts={"Excellent": 1, "Good": 1, "Okay": 1, "Poor": 1},
        label_percentages={"Excellent": 0.25, "Good": 0.25, "Okay": 0.25, "Poor": 0.25},
        at_risk_count=1,
        at_risk_student_ids=["S04"],
        minimum_satisfaction=0.40,
    )
    report = FairnessReport(
        total_students=4,
        run_label_counts={"Excellent": 1, "Good": 1, "Okay": 1, "Poor": 1},
        run_label_percentages={"Excellent": 0.25, "Good": 0.25, "Okay": 0.25, "Poor": 0.25},
        run_at_risk_count=1,
        run_at_risk_student_ids=["S04"],
        by_segment=[summary],
    )

    assert report.by_segment[0].segment_key == "SEG_A"
    assert report.run_label_counts["Poor"] == 1
