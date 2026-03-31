from __future__ import annotations

from app.services.explainability.contracts import (
    ReasonTrace,
    RoomExplanationContext,
    StudentExplanation,
)
from app.services.scoring.constants import SCORING_FACTOR_KEYS
from app.services.scoring.types import FactorScore, PairResult


def _pair_result(score: float) -> PairResult:
    return PairResult(
        pair_score=score,
        factor_breakdown={
            factor_key: FactorScore(raw_score=score, weight_used=0.1, missing_data=False)
            for factor_key in SCORING_FACTOR_KEYS
        },
        excellent_candidate=score >= 0.90,
    )


def test_room_explanation_context_holds_required_fields() -> None:
    context = RoomExplanationContext(
        segment_key="SEG_X",
        room_id="SEG_X_ROOM_001",
        room_size=2,
        student_ids=["S01", "S02"],
        pair_results={("S01", "S02"): _pair_result(0.82)},
        student_satisfaction={"S01": 0.82, "S02": 0.82},
        student_labels={"S01": "Good", "S02": "Good"},
        student_at_risk={"S01": False, "S02": False},
        reason_mode="assigned_room",
    )

    assert context.room_size == 2
    assert context.student_labels["S01"] == "Good"


def test_reason_trace_to_dict_uses_stable_keys() -> None:
    trace = ReasonTrace(
        factor_key="q1_enc",
        factor_class="Strong Match",
        reason_bucket="sleep_alignment",
        polarity="strong_positive",
        template_id="sleep_alignment.strong_positive.v1",
        claim_scope="student_specific_claim",
    )

    serialized = trace.to_dict()

    assert serialized == {
        "factor_key": "q1_enc",
        "factor_class": "Strong Match",
        "reason_bucket": "sleep_alignment",
        "polarity": "strong_positive",
        "template_id": "sleep_alignment.strong_positive.v1",
        "claim_scope": "student_specific_claim",
    }


def test_student_explanation_uses_trace_payload_dicts() -> None:
    explanation = StudentExplanation(
        student_id="S01",
        room_id="SEG_X_ROOM_001",
        satisfaction_label="Good",
        is_at_risk=False,
        reasons=["Your daily routine appears broadly compatible."],
        factor_trace=[
            {
                "factor_key": "q1_enc",
                "factor_class": "Strong Match",
                "reason_bucket": "sleep_alignment",
                "polarity": "strong_positive",
                "template_id": "sleep_alignment.strong_positive.v1",
                "claim_scope": "student_specific_claim",
            }
        ],
    )

    assert explanation.reasons
    assert explanation.factor_trace[0]["factor_key"] == "q1_enc"
