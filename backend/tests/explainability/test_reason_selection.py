from __future__ import annotations

from app.services.explainability.factor_classification import ClassifiedFactor
from app.services.explainability.reason_selection import build_reason_candidates, select_reason_candidates


def _candidate(
    factor_key: str,
    factor_class: str,
    raw_score: float,
    weight_used: float,
    *,
    missing_data: bool = False,
) -> ClassifiedFactor:
    return ClassifiedFactor(
        factor_key=factor_key,
        factor_class=factor_class,
        raw_score=raw_score,
        weight_used=weight_used,
        missing_data=missing_data,
        suppressed_reason=factor_class == "Neutral" or missing_data,
        weight_class="heavy" if factor_key in {"q1_enc", "q2_enc", "q6_enc"} else "medium",
    )


def test_excellent_selects_positive_only() -> None:
    candidates = build_reason_candidates(
        [
            _candidate("q1_enc", "Strong Match", 0.95, 0.20),
            _candidate("q2_enc", "Moderate Match", 0.75, 0.15),
            _candidate("q3_enc", "Moderate Match", 0.72, 0.10),
            _candidate("q9_enc", "Strong Mismatch", 0.10, 0.05),
        ]
    )

    selected = select_reason_candidates("Excellent", candidates)

    assert 2 <= len(selected) <= 3
    assert all(item.factor_class in {"Strong Match", "Moderate Match"} for item in selected)


def test_good_adds_one_mismatch_when_positive_pool_is_small() -> None:
    candidates = build_reason_candidates(
        [
            _candidate("q1_enc", "Strong Match", 0.91, 0.20),
            _candidate("q2_enc", "Strong Mismatch", 0.10, 0.15),
            _candidate("q3_enc", "Moderate Mismatch", 0.30, 0.10),
        ]
    )

    selected = select_reason_candidates("Good", candidates)

    mismatch_count = sum(item.factor_class in {"Strong Mismatch", "Moderate Mismatch"} for item in selected)
    assert mismatch_count == 1


def test_okay_defaults_to_two_positive_and_one_mismatch_when_available() -> None:
    candidates = build_reason_candidates(
        [
            _candidate("q1_enc", "Strong Match", 0.92, 0.20),
            _candidate("q2_enc", "Moderate Match", 0.71, 0.15),
            _candidate("q3_enc", "Strong Mismatch", 0.12, 0.10),
            _candidate("q9_enc", "Moderate Mismatch", 0.28, 0.05),
        ]
    )

    selected = select_reason_candidates("Okay", candidates)

    positive_count = sum(item.factor_class in {"Strong Match", "Moderate Match"} for item in selected)
    mismatch_count = sum(item.factor_class in {"Strong Mismatch", "Moderate Mismatch"} for item in selected)
    assert len(selected) == 3
    assert positive_count == 2
    assert mismatch_count == 1


def test_poor_uses_neutral_context_fallback_when_no_positive_exists() -> None:
    candidates = build_reason_candidates(
        [
            _candidate("q2_enc", "Strong Mismatch", 0.12, 0.15),
            _candidate("q3_enc", "Moderate Mismatch", 0.26, 0.10),
        ]
    )

    selected = select_reason_candidates("Poor", candidates)

    assert len(selected) == 3
    assert selected[-1].reason_bucket == "neutral_context_room"


def test_tie_break_uses_weight_when_scores_are_within_delta() -> None:
    candidates = build_reason_candidates(
        [
            _candidate("q2_enc", "Strong Match", 0.91, 0.15),
            _candidate("q1_enc", "Strong Match", 0.90, 0.20),
            _candidate("q3_enc", "Moderate Match", 0.72, 0.10),
        ]
    )

    selected = select_reason_candidates("Excellent", candidates)

    assert selected[0].factor_key == "q1_enc"


def test_sensitive_factors_are_bucket_deduped() -> None:
    candidates = build_reason_candidates(
        [
            _candidate("q6_enc", "Strong Mismatch", 0.10, 0.15),
            _candidate("q7_enc", "Moderate Mismatch", 0.24, 0.05),
            _candidate("q8_enc", "Moderate Mismatch", 0.22, 0.05),
            _candidate("q1_enc", "Moderate Match", 0.72, 0.20),
        ]
    )

    selected = select_reason_candidates("Poor", candidates)

    sensitive_lines = [item for item in selected if item.reason_bucket == "sensitive_lifestyle"]
    assert len(sensitive_lines) <= 1


def test_neutral_and_missing_data_candidates_are_suppressed() -> None:
    candidates = build_reason_candidates(
        [
            _candidate("q1_enc", "Neutral", 0.55, 0.20),
            _candidate("q2_enc", "Strong Match", 0.90, 0.15),
            _candidate("q3_enc", "Moderate Match", 0.66, 0.10, missing_data=True),
        ]
    )

    selected = select_reason_candidates("Good", candidates)

    assert len(selected) == 1
    assert selected[0].factor_key == "q2_enc"
