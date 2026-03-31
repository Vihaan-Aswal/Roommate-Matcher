from __future__ import annotations

from app.services.fairness.distribution import compute_fairness_distribution


def test_distribution_counts_and_percentages_match_expected_values() -> None:
    records = [
        {
            "student_id": "A01",
            "segment_key": "SEG_A",
            "satisfaction_score": 0.93,
            "satisfaction_label": "Excellent",
            "is_at_risk": False,
        },
        {
            "student_id": "A02",
            "segment_key": "SEG_A",
            "satisfaction_score": 0.75,
            "satisfaction_label": "Good",
            "is_at_risk": False,
        },
        {
            "student_id": "A03",
            "segment_key": "SEG_B",
            "satisfaction_score": 0.56,
            "satisfaction_label": "Okay",
            "is_at_risk": False,
        },
        {
            "student_id": "A04",
            "segment_key": "SEG_B",
            "satisfaction_score": 0.42,
            "satisfaction_label": "Poor",
            "is_at_risk": True,
        },
    ]

    report = compute_fairness_distribution(records)

    assert report.total_students == 4
    assert report.run_label_counts == {"Excellent": 1, "Good": 1, "Okay": 1, "Poor": 1}
    assert report.run_label_percentages == {
        "Excellent": 0.25,
        "Good": 0.25,
        "Okay": 0.25,
        "Poor": 0.25,
    }
    assert report.run_at_risk_count == 1
    assert report.run_at_risk_student_ids == ["A04"]


def test_distribution_uses_explicit_at_risk_flag_not_label_inference() -> None:
    records = [
        {
            "student_id": "B01",
            "segment_key": "SEG_X",
            "satisfaction_score": 0.60,
            "satisfaction_label": "Good",
            "is_at_risk": True,
        },
        {
            "student_id": "B02",
            "segment_key": "SEG_X",
            "satisfaction_score": 0.52,
            "satisfaction_label": "Poor",
            "is_at_risk": False,
        },
    ]

    report = compute_fairness_distribution(records)

    assert report.run_label_counts["Good"] == 1
    assert report.run_label_counts["Poor"] == 1
    assert report.run_at_risk_count == 1
    assert report.run_at_risk_student_ids == ["B01"]


def test_distribution_segment_summaries_are_sorted_and_reconciled() -> None:
    records = [
        {
            "student_id": "C02",
            "segment_key": "SEG_Z",
            "satisfaction_score": 0.57,
            "satisfaction_label": "Okay",
            "is_at_risk": False,
        },
        {
            "student_id": "C01",
            "segment_key": "SEG_A",
            "satisfaction_score": 0.40,
            "satisfaction_label": "Poor",
            "is_at_risk": True,
        },
        {
            "student_id": "C03",
            "segment_key": "SEG_Z",
            "satisfaction_score": 0.90,
            "satisfaction_label": "Excellent",
            "is_at_risk": False,
        },
    ]

    report = compute_fairness_distribution(records)

    assert [segment.segment_key for segment in report.by_segment] == ["SEG_A", "SEG_Z"]
    for segment in report.by_segment:
        assert sum(segment.label_counts.values()) == segment.total_students
        assert segment.at_risk_count == len(segment.at_risk_student_ids)
