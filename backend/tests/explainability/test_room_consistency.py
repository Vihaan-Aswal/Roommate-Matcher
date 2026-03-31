from __future__ import annotations

from app.services.explainability.consistency import enforce_room_consistency
from app.services.explainability.reason_selection import ReasonCandidate


def _reason(
    *,
    factor_key: str,
    bucket: str,
    factor_class: str,
    raw_score: float,
    weight_used: float,
    claim_scope: str,
) -> ReasonCandidate:
    return ReasonCandidate(
        factor_key=factor_key,
        reason_bucket=bucket,
        factor_class=factor_class,
        polarity="mismatch" if "Mismatch" in factor_class else "strong_positive",
        raw_score=raw_score,
        weight_used=weight_used,
        claim_scope=claim_scope,
        missing_data=False,
    )


def test_room_shared_conflict_drops_lower_ranked_conflicting_claim() -> None:
    by_student = {
        "S01": [
            _reason(
                factor_key="q1_enc",
                bucket="sleep_alignment",
                factor_class="Strong Match",
                raw_score=0.92,
                weight_used=0.20,
                claim_scope="room_shared_claim",
            )
        ],
        "S02": [
            _reason(
                factor_key="q1_enc",
                bucket="sleep_alignment",
                factor_class="Strong Mismatch",
                raw_score=0.20,
                weight_used=0.20,
                claim_scope="room_shared_claim",
            )
        ],
    }

    resolved = enforce_room_consistency(by_student)

    all_claims = [item for claims in resolved.values() for item in claims]
    has_positive = any(item.factor_class in {"Strong Match", "Moderate Match"} for item in all_claims)
    has_mismatch = any(item.factor_class in {"Strong Mismatch", "Moderate Mismatch"} for item in all_claims)

    assert has_positive is True
    assert has_mismatch is False


def test_student_specific_claims_are_not_suppressed_by_other_students() -> None:
    by_student = {
        "S01": [
            _reason(
                factor_key="q3_enc",
                bucket="late_return_alignment",
                factor_class="Strong Match",
                raw_score=0.92,
                weight_used=0.10,
                claim_scope="student_specific_claim",
            )
        ],
        "S02": [
            _reason(
                factor_key="q3_enc",
                bucket="late_return_alignment",
                factor_class="Strong Mismatch",
                raw_score=0.20,
                weight_used=0.10,
                claim_scope="student_specific_claim",
            )
        ],
    }

    resolved = enforce_room_consistency(by_student)

    assert len(resolved["S01"]) == 1
    assert len(resolved["S02"]) == 1
