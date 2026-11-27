from __future__ import annotations

import json
import os
from itertools import combinations
from pathlib import Path

import pytest

from app.services.matching.engine import run_matching_for_segment
from app.services.scoring.pipeline import compute_pair_score
from app.services.scoring.types import ScoringProfile
from tests.matching.fixtures import (
    adversarial_swap_improves_minimum,
    clean_2bed_clear_optimum,
    determinism_tie_pressure,
    four_bed_ambiguous_pair_merges,
    three_bed_leftover_solo,
    uniformly_weak_segment,
)

GOLDEN_PATH = Path(__file__).with_name("matching_plan.json")

ENGINE_FIXTURES = {
    "clean_2bed_clear_optimum": clean_2bed_clear_optimum,
    "three_bed_leftover_solo": three_bed_leftover_solo,
    "four_bed_ambiguous_pair_merges": four_bed_ambiguous_pair_merges,
    "adversarial_swap_improves_minimum": adversarial_swap_improves_minimum,
    "uniformly_weak_segment": uniformly_weak_segment,
    "determinism_tie_pressure": determinism_tie_pressure,
}


def _round(value: float) -> float:
    return round(float(value), 12)


def _profile(admission_number: str, **overrides: float | None) -> ScoringProfile:
    values: dict[str, float | None] = {
        "q1_enc": 1.0,
        "q2_enc": 1.0,
        "q3_enc": 1.0,
        "q4a_enc": 1.0,
        "q4b_enc": 1.5,
        "q5a_enc": 1.0,
        "q5b_enc": 1.5,
        "q6_enc": 1.0,
        "q7_enc": 1.0,
        "q8_enc": 1.0,
        "q9_enc": 1.0,
        "q10_enc": 1.5,
    }
    values.update(overrides)
    return ScoringProfile(admission_number=admission_number, has_preferences=True, **values)


SCORING_PROFILES = [
    _profile("ADM001"),
    _profile("ADM002"),
    _profile(
        "ADM003",
        q1_enc=3.0,
        q2_enc=2.0,
        q3_enc=2.0,
        q4a_enc=2.0,
        q4b_enc=0.0,
        q5a_enc=2.0,
        q5b_enc=0.0,
        q6_enc=3.0,
        q7_enc=3.0,
        q8_enc=3.0,
        q9_enc=2.0,
        q10_enc=0.0,
    ),
    _profile(
        "ADM004",
        q1_enc=None,
        q3_enc=None,
        q4a_enc=None,
        q5b_enc=None,
        q7_enc=None,
        q9_enc=None,
        q6_enc=2.0,
        q10_enc=2.0,
    ),
    _profile(
        "ADM005",
        q1_enc=None,
        q2_enc=None,
        q3_enc=None,
        q4a_enc=None,
        q4b_enc=None,
        q5a_enc=None,
        q5b_enc=None,
        q6_enc=None,
        q7_enc=None,
        q8_enc=None,
        q9_enc=None,
        q10_enc=None,
    ),
    _profile(
        "ADM006",
        q1_enc=0.0,
        q2_enc=0.0,
        q3_enc=0.0,
        q4a_enc=0.0,
        q4b_enc=3.0,
        q5a_enc=0.0,
        q5b_enc=3.0,
        q9_enc=0.0,
        q10_enc=3.0,
    ),
    _profile(
        "ADM007",
        q1_enc=2.0,
        q2_enc=0.0,
        q3_enc=1.0,
        q4a_enc=2.0,
        q4b_enc=1.0,
        q5a_enc=0.0,
        q5b_enc=2.5,
        q6_enc=2.0,
        q7_enc=1.0,
        q8_enc=3.0,
        q9_enc=1.0,
        q10_enc=0.5,
    ),
    _profile(
        "ADM008",
        q1_enc=0.0,
        q2_enc=None,
        q3_enc=2.0,
        q4a_enc=None,
        q4b_enc=3.0,
        q5a_enc=2.0,
        q5b_enc=0.0,
        q6_enc=None,
        q7_enc=2.0,
        q9_enc=1.0,
        q10_enc=None,
    ),
]


def _engine_plan(result) -> dict[str, object]:
    return {
        "rooms": [
            {
                "room_id": room.room_id,
                "student_ids": sorted(room.student_ids),
                "group_score": _round(room.group_score),
                "needs_review": room.needs_review,
            }
            for room in sorted(result.rooms, key=lambda item: item.room_id)
        ],
        "students": [
            {
                "student_id": student.student_id,
                "room_id": student.room_id,
                "roommate_ids": sorted(student.roommate_ids),
                "satisfaction_score": _round(student.satisfaction_score),
                "satisfaction_label": student.satisfaction_label,
                "excellent_safety_passed": student.excellent_safety_passed,
                "is_at_risk": student.is_at_risk,
            }
            for student in sorted(result.students, key=lambda item: item.student_id)
        ],
        "room_metrics": [
            {
                "room_id": metric.room_id,
                "group_score": _round(metric.group_score),
                "min_student_satisfaction": _round(metric.min_student_satisfaction),
                "poor_count": metric.poor_count,
            }
            for metric in sorted(result.room_metrics, key=lambda item: item.room_id)
        ],
        "at_risk_student_ids": sorted(result.at_risk_student_ids),
        "label_counts": dict(sorted(result.label_counts.items())),
        "swap_passes_applied": result.swap_passes_applied,
        "minimum_satisfaction": _round(result.minimum_satisfaction),
    }


def _scoring_plan() -> dict[str, object]:
    plan: dict[str, object] = {}
    for profile_a, profile_b in combinations(SCORING_PROFILES, 2):
        first, second = sorted(
            (profile_a, profile_b), key=lambda profile: profile.admission_number
        )
        result = compute_pair_score(first, second)
        plan[f"{first.admission_number}|{second.admission_number}"] = {
            "pair_score": _round(result.pair_score),
            "excellent_candidate": result.excellent_candidate,
            "factor_breakdown": {
                key: {
                    "raw_score": _round(item.raw_score),
                    "weight_used": _round(item.weight_used),
                    "missing_data": item.missing_data,
                }
                for key, item in result.factor_breakdown.items()
            },
        }
    return plan


def _build_plan() -> dict[str, object]:
    return {
        "engine": {
            name: _engine_plan(run_matching_for_segment(factory()))
            for name, factory in ENGINE_FIXTURES.items()
        },
        "scoring": _scoring_plan(),
    }


def test_matching_and_scoring_plans_match_golden() -> None:
    plan = _build_plan()

    if os.environ.get("UPDATE_GOLDEN") == "1":
        if "CI" in os.environ:
            pytest.fail(
                "UPDATE_GOLDEN is disabled in CI; generate locally and commit the diff"
            )
        GOLDEN_PATH.write_text(
            json.dumps(plan, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        return

    expected = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
    assert plan == expected
