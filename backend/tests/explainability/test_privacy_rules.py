from __future__ import annotations

import pytest

from app.services.explainability.privacy_rules import PrivacyViolationError, validate_privacy_text
from app.services.explainability.reason_selection import ReasonCandidate
from app.services.explainability.template_renderer import render_reason_lines


def _reason(
    factor_key: str,
    reason_bucket: str,
    factor_class: str,
    polarity: str,
) -> ReasonCandidate:
    return ReasonCandidate(
        factor_key=factor_key,
        reason_bucket=reason_bucket,
        factor_class=factor_class,
        polarity=polarity,
        raw_score=0.8,
        weight_used=0.1,
        claim_scope="student_specific_claim",
        missing_data=False,
    )


@pytest.mark.parametrize(
    "blocked_line",
    [
        "One roommate is a smoker.",
        "This pair has a drinker and a non-veg preference mismatch.",
        "Alcohol habits are very different.",
    ],
)
def test_validate_privacy_text_blocks_sensitive_terms(blocked_line: str) -> None:
    with pytest.raises(PrivacyViolationError):
        validate_privacy_text([blocked_line])


def test_validate_privacy_text_allows_generic_lifestyle_wording() -> None:
    validate_privacy_text(
        [
            "Lifestyle differences may require clear expectations.",
            "Broader lifestyle preferences look reasonably compatible.",
        ]
    )


def test_renderer_rejects_sensitive_factor_in_non_sensitive_bucket() -> None:
    selected = [_reason("q6_enc", "sleep_alignment", "Strong Match", "strong_positive")]
    with pytest.raises(PrivacyViolationError):
        render_reason_lines(student_id="S01", room_id="R1", selected_candidates=selected)


def test_renderer_keeps_sensitive_lines_generic() -> None:
    selected = [_reason("q7_enc", "sensitive_lifestyle", "Moderate Mismatch", "mismatch")]
    lines, _ = render_reason_lines(student_id="S01", room_id="R1", selected_candidates=selected)

    joined = " ".join(lines).lower()
    assert "smoker" not in joined
    assert "drinker" not in joined
    assert "non-veg" not in joined
