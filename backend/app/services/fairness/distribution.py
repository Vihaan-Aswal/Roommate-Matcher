from __future__ import annotations

from dataclasses import dataclass, is_dataclass
from typing import Iterable

from app.services.fairness.contracts import FairnessReport, LABEL_ORDER, SegmentFairnessSummary


@dataclass(frozen=True)
class FairnessInputRecord:
    student_id: str
    segment_key: str
    satisfaction_score: float
    satisfaction_label: str
    is_at_risk: bool


def _round_percentage(value: float) -> float:
    return round(value, 4)


def _empty_label_counts() -> dict[str, int]:
    return {label: 0 for label in LABEL_ORDER}


def _label_percentages(label_counts: dict[str, int], total_students: int) -> dict[str, float]:
    if total_students == 0:
        return {label: 0.0 for label in LABEL_ORDER}
    return {
        label: _round_percentage(label_counts[label] / total_students)
        for label in LABEL_ORDER
    }


def _coerce_record(record: FairnessInputRecord | dict[str, object]) -> FairnessInputRecord:
    if isinstance(record, FairnessInputRecord):
        return record

    if is_dataclass(record):
        return FairnessInputRecord(
            student_id=getattr(record, "student_id"),
            segment_key=getattr(record, "segment_key"),
            satisfaction_score=getattr(record, "satisfaction_score"),
            satisfaction_label=getattr(record, "satisfaction_label"),
            is_at_risk=getattr(record, "is_at_risk"),
        )

    if isinstance(record, dict):
        return FairnessInputRecord(
            student_id=str(record["student_id"]),
            segment_key=str(record["segment_key"]),
            satisfaction_score=float(record["satisfaction_score"]),
            satisfaction_label=str(record["satisfaction_label"]),
            is_at_risk=bool(record["is_at_risk"]),
        )

    raise TypeError("Each fairness input record must be FairnessInputRecord or dict")


def compute_fairness_distribution(
    satisfaction_scores: Iterable[FairnessInputRecord | dict[str, object]],
) -> FairnessReport:
    run_label_counts = _empty_label_counts()
    run_at_risk_student_ids: list[str] = []

    segment_records: dict[str, list[FairnessInputRecord]] = {}
    normalized_records: list[FairnessInputRecord] = []

    for raw_record in satisfaction_scores:
        record = _coerce_record(raw_record)
        if record.satisfaction_label not in LABEL_ORDER:
            raise ValueError(f"Unsupported satisfaction label: {record.satisfaction_label}")

        normalized_records.append(record)
        run_label_counts[record.satisfaction_label] += 1
        if record.is_at_risk:
            run_at_risk_student_ids.append(record.student_id)
        segment_records.setdefault(record.segment_key, []).append(record)

    total_students = len(normalized_records)
    run_label_percentages = _label_percentages(run_label_counts, total_students)

    by_segment: list[SegmentFairnessSummary] = []
    for segment_key in sorted(segment_records):
        records = segment_records[segment_key]
        segment_counts = _empty_label_counts()
        segment_at_risk: list[str] = []

        for record in records:
            segment_counts[record.satisfaction_label] += 1
            if record.is_at_risk:
                segment_at_risk.append(record.student_id)

        segment_total = len(records)
        segment_percentages = _label_percentages(segment_counts, segment_total)
        minimum_satisfaction = min((record.satisfaction_score for record in records), default=0.0)

        by_segment.append(
            SegmentFairnessSummary(
                segment_key=segment_key,
                total_students=segment_total,
                label_counts=segment_counts,
                label_percentages=segment_percentages,
                at_risk_count=len(segment_at_risk),
                at_risk_student_ids=sorted(segment_at_risk),
                minimum_satisfaction=minimum_satisfaction,
            )
        )

    return FairnessReport(
        total_students=total_students,
        run_label_counts=run_label_counts,
        run_label_percentages=run_label_percentages,
        run_at_risk_count=len(run_at_risk_student_ids),
        run_at_risk_student_ids=sorted(run_at_risk_student_ids),
        by_segment=by_segment,
    )
