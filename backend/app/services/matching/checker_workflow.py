from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.preference_profile import PreferenceProfile
from app.models.segment import Segment
from app.models.student import Student
from app.services.explainability.contracts import HypotheticalGroupInput
from app.services.explainability.service import explain_hypothetical_group
from app.services.matching.adapter import profile_to_scoring_profile
from app.services.matching.labels import derive_satisfaction_label
from app.services.matching.satisfaction import compute_group_score, compute_student_satisfaction_scores
from app.services.scoring.segment_matrix import compute_segment_pair_scores
from app.services.scoring.types import ScoringProfile

NEUTRAL_ENCODED_VALUES: dict[str, float] = {
    "q1_enc": 2.5,
    "q2_enc": 2.0,
    "q3_enc": 2.0,
    "q4a_enc": 1.0,
    "q4b_enc": 1.5,
    "q5a_enc": 1.0,
    "q5b_enc": 1.5,
    "q6_enc": 2.0,
    "q7_enc": 2.0,
    "q8_enc": 2.0,
    "q9_enc": 2.0,
    "q10_enc": 1.5,
}


@dataclass(frozen=True)
class CheckerResult:
    group_score: float
    group_label: str
    at_risk_students: list[str]
    students: list[dict[str, object]]


def _neutral_profile(admission_number: str) -> ScoringProfile:
    return ScoringProfile(
        admission_number=admission_number,
        has_preferences=False,
        q1_enc=NEUTRAL_ENCODED_VALUES["q1_enc"],
        q2_enc=NEUTRAL_ENCODED_VALUES["q2_enc"],
        q3_enc=NEUTRAL_ENCODED_VALUES["q3_enc"],
        q4a_enc=NEUTRAL_ENCODED_VALUES["q4a_enc"],
        q4b_enc=NEUTRAL_ENCODED_VALUES["q4b_enc"],
        q5a_enc=NEUTRAL_ENCODED_VALUES["q5a_enc"],
        q5b_enc=NEUTRAL_ENCODED_VALUES["q5b_enc"],
        q6_enc=NEUTRAL_ENCODED_VALUES["q6_enc"],
        q7_enc=NEUTRAL_ENCODED_VALUES["q7_enc"],
        q8_enc=NEUTRAL_ENCODED_VALUES["q8_enc"],
        q9_enc=NEUTRAL_ENCODED_VALUES["q9_enc"],
        q10_enc=NEUTRAL_ENCODED_VALUES["q10_enc"],
    )


def _with_neutral_fallback(profile: ScoringProfile) -> ScoringProfile:
    return ScoringProfile(
        admission_number=profile.admission_number,
        has_preferences=profile.has_preferences,
        q1_enc=profile.q1_enc if profile.q1_enc is not None else NEUTRAL_ENCODED_VALUES["q1_enc"],
        q2_enc=profile.q2_enc if profile.q2_enc is not None else NEUTRAL_ENCODED_VALUES["q2_enc"],
        q3_enc=profile.q3_enc if profile.q3_enc is not None else NEUTRAL_ENCODED_VALUES["q3_enc"],
        q4a_enc=profile.q4a_enc if profile.q4a_enc is not None else NEUTRAL_ENCODED_VALUES["q4a_enc"],
        q4b_enc=profile.q4b_enc if profile.q4b_enc is not None else NEUTRAL_ENCODED_VALUES["q4b_enc"],
        q5a_enc=profile.q5a_enc if profile.q5a_enc is not None else NEUTRAL_ENCODED_VALUES["q5a_enc"],
        q5b_enc=profile.q5b_enc if profile.q5b_enc is not None else NEUTRAL_ENCODED_VALUES["q5b_enc"],
        q6_enc=profile.q6_enc if profile.q6_enc is not None else NEUTRAL_ENCODED_VALUES["q6_enc"],
        q7_enc=profile.q7_enc if profile.q7_enc is not None else NEUTRAL_ENCODED_VALUES["q7_enc"],
        q8_enc=profile.q8_enc if profile.q8_enc is not None else NEUTRAL_ENCODED_VALUES["q8_enc"],
        q9_enc=profile.q9_enc if profile.q9_enc is not None else NEUTRAL_ENCODED_VALUES["q9_enc"],
        q10_enc=profile.q10_enc if profile.q10_enc is not None else NEUTRAL_ENCODED_VALUES["q10_enc"],
    )


def run_manual_checker(
    db: Session,
    *,
    segment_key: str,
    room_size: int,
    student_ids: list[str],
    precomputed_satisfaction: dict[str, float] | None,
    precomputed_labels: dict[str, str] | None,
) -> CheckerResult:
    if not student_ids:
        raise ValueError("student_ids must not be empty")
    if len(set(student_ids)) != len(student_ids):
        raise ValueError("student_ids must be unique")
    if len(student_ids) != room_size:
        raise ValueError("student_ids count must equal room_size")

    segment = db.get(Segment, segment_key)
    if segment is None:
        raise ValueError("Segment not found")
    if segment.room_size != room_size:
        raise ValueError("room_size does not match segment room size")

    students = db.scalars(
        select(Student)
        .where(
            Student.segment_key == segment_key,
            Student.admission_number.in_(student_ids),
        )
        .order_by(Student.admission_number)
    ).all()
    if len(students) != len(student_ids):
        raise ValueError("One or more student_ids are not in the target segment")

    active_profiles = db.scalars(
        select(PreferenceProfile)
        .where(
            PreferenceProfile.is_active == 1,
            PreferenceProfile.admission_number.in_(student_ids),
        )
    ).all()
    profile_map = {profile.admission_number: profile for profile in active_profiles}

    scoring_profiles: list[ScoringProfile] = []
    ordered_student_ids = sorted(student_ids)
    for student_id in ordered_student_ids:
        profile = profile_map.get(student_id)
        if profile is None:
            scoring_profiles.append(_neutral_profile(student_id))
            continue
        scoring_profiles.append(_with_neutral_fallback(profile_to_scoring_profile(profile)))

    pair_results = compute_segment_pair_scores(scoring_profiles)

    if precomputed_satisfaction is None:
        student_satisfaction = compute_student_satisfaction_scores(ordered_student_ids, pair_results)
    else:
        student_satisfaction = {student_id: float(precomputed_satisfaction[student_id]) for student_id in ordered_student_ids}

    if precomputed_labels is None:
        student_labels = {
            student_id: derive_satisfaction_label(
                student_satisfaction[student_id],
                safety_passed=True,
            )
            for student_id in ordered_student_ids
        }
    else:
        student_labels = {student_id: str(precomputed_labels[student_id]) for student_id in ordered_student_ids}

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
            }
        )

    return CheckerResult(
        group_score=group_score,
        group_label=group_label,
        at_risk_students=at_risk_students,
        students=student_rows,
    )
