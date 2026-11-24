from __future__ import annotations

import app.services.orchestration.checker_workflow as checker_workflow
import app.services.orchestration.run_workflow as run_workflow
from app.services.scoring.neutral import (
    NEUTRAL_ENCODED_VALUES,
    neutral_profile,
    with_neutral_fallback,
)
from app.services.scoring.types import ScoringProfile


def test_both_workflows_share_one_neutral_profile_definition() -> None:
    assert neutral_profile("A").q1_enc == NEUTRAL_ENCODED_VALUES["q1_enc"]
    assert neutral_profile("A").has_preferences is False
    assert run_workflow.neutral_profile is neutral_profile
    assert run_workflow.with_neutral_fallback is with_neutral_fallback
    assert checker_workflow.neutral_profile is neutral_profile
    assert checker_workflow.with_neutral_fallback is with_neutral_fallback


def test_with_neutral_fallback_keeps_set_values_and_fills_none() -> None:
    profile = ScoringProfile(
        admission_number="A",
        has_preferences=True,
        q1_enc=0.25,
        q2_enc=None,
        q3_enc=1.0,
        q4a_enc=1.0,
        q4b_enc=1.0,
        q5a_enc=1.0,
        q5b_enc=1.0,
        q6_enc=1.0,
        q7_enc=1.0,
        q8_enc=1.0,
        q9_enc=1.0,
        q10_enc=1.0,
    )

    filled = with_neutral_fallback(profile)

    assert filled.admission_number == "A"
    assert filled.has_preferences is True
    assert filled.q1_enc == 0.25
    assert filled.q2_enc == NEUTRAL_ENCODED_VALUES["q2_enc"]
    assert filled.q10_enc == 1.0
