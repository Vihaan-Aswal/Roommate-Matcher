from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.preference_profile import PreferenceProfile
from app.models.segment import Segment
from app.models.student import Student
from app.services.explainability.contracts import HypotheticalGroupInput
from app.services.explainability.service import explain_hypothetical_group
from app.services.matching.adapter import profile_to_scoring_profile
from app.services.matching.labels import classify_student, derive_satisfaction_label
from app.services.matching.satisfaction import compute_group_score, compute_student_satisfaction_scores
from app.services.scoring.neutral import neutral_profile, with_neutral_fallback
from app.services.scoring.segment_matrix import compute_segment_pair_scores
from app.services.scoring.types import ScoringProfile


@dataclass(frozen=True)
class CheckerResult:
    group_score: float
    group_label: str
    at_risk_students: list[str]
    students: list[dict[str, object]]


def run_manual_checker(
    db: Session,
    *,
    segment_key: str,
    workspace_id: uuid.UUID,
    room_size: int,
    student_ids: list[str],
) -> CheckerResult:
    if not student_ids:
        raise ValueError("student_ids must not be empty")
    if len(set(student_ids)) != len(student_ids):
        raise ValueError("student_ids must be unique")
    if len(student_ids) != room_size:
        raise ValueError("student_ids count must equal room_size")

    segment = db.scalars(select(Segment).where(Segment.segment_key == segment_key, Segment.workspace_id == workspace_id)).first()
    if segment is None:
        raise ValueError("Segment not found")
    if segment.room_size != room_size:
        raise ValueError("room_size does not match segment room size")

    students = db.scalars(
        select(Student)
        .where(
            Student.segment_id == segment.id,
            Student.workspace_id == workspace_id,
            Student.admission_number.in_(student_ids),
            Student.is_active == True,
        )
        .order_by(Student.admission_number)
    ).all()
    if len(students) != len(student_ids):
        raise ValueError("One or more student_ids are invalid, not in the target segment, or inactive")

    student_id_map = {student.id: student.admission_number for student in students}
    active_profiles = db.scalars(
        select(PreferenceProfile)
        .where(
            PreferenceProfile.workspace_id == workspace_id,
            PreferenceProfile.is_active == True,
            PreferenceProfile.student_id.in_(list(student_id_map.keys())),
        )
    ).all()
    profile_map = {student_id_map[profile.student_id]: profile for profile in active_profiles}

    scoring_profiles: list[ScoringProfile] = []
    ordered_student_ids = sorted(student_ids)
    for student_id in ordered_student_ids:
        profile = profile_map.get(student_id)
        if profile is None:
            scoring_profiles.append(neutral_profile(student_id))
            continue
        scoring_profiles.append(with_neutral_fallback(profile_to_scoring_profile(profile, admission_number=student_id)))

    pair_results = compute_segment_pair_scores(scoring_profiles)

    student_satisfaction = compute_student_satisfaction_scores(ordered_student_ids, pair_results)

    student_labels = {
        student_id: classify_student(
            student_id,
            [other for other in ordered_student_ids if other != student_id],
            student_satisfaction[student_id],
            pair_results,
        )[0]
        for student_id in ordered_student_ids
    }

    explanations = explain_hypothetical_group(
        HypotheticalGroupInput(
            segment_key=segment_key,
            room_size=room_size,
            student_ids=ordered_student_ids,
            pair_results=pair_results,
            precomputed_satisfaction=student_satisfaction,
            precomputed_labels=student_labels,
        )
    )
    explanation_map = {item.student_id: item for item in explanations}

    at_risk_students = sorted(
        [
            student_id
            for student_id, score in student_satisfaction.items()
            if score < 0.55
        ]
    )
    group_score = compute_group_score(ordered_student_ids, pair_results)
    group_label = derive_satisfaction_label(
        group_score,
        safety_passed=all(label == "Excellent" for label in student_labels.values()),
    )

    student_rows: list[dict[str, object]] = []
    for student_id in ordered_student_ids:
        explanation = explanation_map[student_id]
        student_rows.append(
            {
                "admission_number": student_id,
                "satisfaction_score": student_satisfaction[student_id],
                "satisfaction_label": student_labels[student_id],
                "reasons": explanation.reasons,
                "is_at_risk": student_id in at_risk_students,
                "factor_trace": explanation.factor_trace,
            }
        )

    return CheckerResult(
        group_score=group_score,
        group_label=group_label,
        at_risk_students=at_risk_students,
        students=student_rows,
    )
