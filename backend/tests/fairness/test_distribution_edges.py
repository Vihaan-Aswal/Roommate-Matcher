"""Edge cases for the fairness distribution: empty runs and bad inputs."""
from __future__ import annotations

from dataclasses import dataclass

import pytest

from app.services.fairness.contracts import LABEL_ORDER
from app.services.fairness.distribution import (
    FairnessInputRecord,
    compute_fairness_distribution,
)


def test_empty_run_reports_zero_percentages() -> None:
    report = compute_fairness_distribution([])

    assert report.total_students == 0
    assert report.run_label_counts == {label: 0 for label in LABEL_ORDER}
    assert report.run_label_percentages == {label: 0.0 for label in LABEL_ORDER}
    assert report.run_at_risk_count == 0
    assert report.by_segment == []


def test_dataclass_records_are_coerced_without_losing_fields() -> None:
    @dataclass(frozen=True)
    class ExternalRecord:
        student_id: str
        segment_key: str
        satisfaction_score: float
        satisfaction_label: str
        is_at_risk: bool

    report = compute_fairness_distribution(
        [
            ExternalRecord("S1", "SEG_A", 0.9, "Excellent", False),
            ExternalRecord("S2", "SEG_A", 0.3, "Poor", True),
        ]
    )

    assert report.total_students == 2
    assert report.run_label_counts["Excellent"] == 1
    assert report.run_at_risk_student_ids == ["S2"]
    assert report.by_segment[0].minimum_satisfaction == 0.3


def test_dict_records_are_coerced() -> None:
    report = compute_fairness_distribution(
        [
            {
                "student_id": "S1",
                "segment_key": "SEG_A",
                "satisfaction_score": 0.75,
                "satisfaction_label": "Good",
                "is_at_risk": False,
            }
        ]
    )

    assert report.total_students == 1
    assert report.run_label_percentages["Good"] == 1.0


def test_unsupported_record_type_is_rejected() -> None:
    with pytest.raises(TypeError, match="must be FairnessInputRecord or dict"):
        compute_fairness_distribution(["not-a-record"])  # type: ignore[list-item]


def test_unsupported_label_is_rejected() -> None:
    with pytest.raises(ValueError, match="Unsupported satisfaction label"):
        compute_fairness_distribution(
            [FairnessInputRecord("S1", "SEG_A", 0.5, "Amazing", False)]
        )
