from __future__ import annotations

from collections.abc import Iterable

from app.models.preference_profile import PreferenceProfile
from app.services.scoring.types import ScoringProfile


def profile_to_scoring_profile(profile: PreferenceProfile) -> ScoringProfile:
    return ScoringProfile(
        admission_number=profile.admission_number,
        has_preferences=bool(profile.has_preferences),
        q1_enc=profile.q1_enc,
        q2_enc=profile.q2_enc,
        q3_enc=profile.q3_enc,
        q4a_enc=profile.q4a_enc,
        q4b_enc=profile.q4b_enc,
        q5a_enc=profile.q5a_enc,
        q5b_enc=profile.q5b_enc,
        q6_enc=profile.q6_enc,
        q7_enc=profile.q7_enc,
        q8_enc=profile.q8_enc,
        q9_enc=profile.q9_enc,
        q10_enc=profile.q10_enc,
    )


def profiles_to_scoring_profiles(profiles: Iterable[PreferenceProfile]) -> list[ScoringProfile]:
    return [profile_to_scoring_profile(profile) for profile in profiles]
