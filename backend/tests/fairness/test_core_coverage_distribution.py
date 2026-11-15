from __future__ import annotations

from dataclasses import dataclass

import pytest

from app.services.fairness.distribution import (
    FairnessInputRecord,
    compute_fairness_distribution,
)


@dataclass(frozen=True)
class _RecordLike:
    student_id: str
    segment_key: str
    satisfaction_score: float
    satisfaction_label: str
    is_at_risk: bool


def test_empty_input_yields_zero_percentages() -> None:
    report = compute_fairness_distribution([])

    assert report.total_students == 0
    assert report.run_label_counts == {"Excellent": 0, "Good": 0, "Okay": 0, "Poor": 0}
    assert report.run_label_percentages == {"Excellent": 0.0, "Good": 0.0, "Okay": 0.0, "Poor": 0.0}
    assert report.run_at_risk_count == 0
    assert report.by_segment == []


def test_foreign_dataclass_record_is_coerced() -> None:
    report = compute_fairness_distribution(
        [
            _RecordLike(
                student_id="A01",
                segment_key="SEG_A",
                satisfaction_score=0.93,
                satisfaction_label="Excellent",
                is_at_risk=False,
            )
        ]
    )

    assert report.total_students == 1
    assert report.run_label_counts["Excellent"] == 1
    assert report.by_segment[0].minimum_satisfaction == 0.93


def test_native_record_instance_is_accepted() -> None:
    report = compute_fairness_distribution(
        [
            FairnessInputRecord(
                student_id="A02",
                segment_key="SEG_A",
                satisfaction_score=0.42,
                satisfaction_label="Poor",
                is_at_risk=True,
            )
        ]
    )

    assert report.run_at_risk_student_ids == ["A02"]
    assert report.run_label_percentages["Poor"] == 1.0


def test_unsupported_record_type_is_rejected() -> None:
    with pytest.raises(TypeError, match="must be FairnessInputRecord or dict"):
        compute_fairness_distribution([object()])


def test_unsupported_satisfaction_label_is_rejected() -> None:
    with pytest.raises(ValueError, match="Unsupported satisfaction label: Great"):
        compute_fairness_distribution(
            [
                {
                    "student_id": "A03",
                    "segment_key": "SEG_A",
                    "satisfaction_score": 0.99,
                    "satisfaction_label": "Great",
                    "is_at_risk": False,
                }
            ]
        )
