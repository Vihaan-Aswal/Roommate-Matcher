from __future__ import annotations

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


def neutral_profile(admission_number: str) -> ScoringProfile:
    return ScoringProfile(
        admission_number=admission_number,
        has_preferences=False,
        **NEUTRAL_ENCODED_VALUES,
    )


def with_neutral_fallback(profile: ScoringProfile) -> ScoringProfile:
    with_fallback = {
        key: getattr(profile, key) if getattr(profile, key) is not None else default
        for key, default in NEUTRAL_ENCODED_VALUES.items()
    }
    return ScoringProfile(
        admission_number=profile.admission_number,
        has_preferences=profile.has_preferences,
        **with_fallback,
    )
