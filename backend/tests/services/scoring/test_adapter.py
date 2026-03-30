from app.models.preference_profile import PreferenceProfile
from app.services.matching.adapter import profile_to_scoring_profile, profiles_to_scoring_profiles
from app.services.scoring.types import ScoringProfile


def test_profile_to_scoring_profile_maps_all_fields() -> None:
    profile = PreferenceProfile(
        admission_number="ADM100",
        has_preferences=1,
        is_active=1,
        q1_enc=1.0,
        q2_enc=2.0,
        q3_enc=3.0,
        q4a_enc=2.0,
        q4b_enc=3.0,
        q5a_enc=1.0,
        q5b_enc=0.0,
        q6_enc=2.0,
        q7_enc=1.0,
        q8_enc=3.0,
        q9_enc=2.0,
        q10_enc=0.0,
    )

    result = profile_to_scoring_profile(profile)

    assert isinstance(result, ScoringProfile)
    assert result.admission_number == "ADM100"
    assert result.has_preferences is True
    assert result.q1_enc == 1.0
    assert result.q4b_enc == 3.0
    assert result.q10_enc == 0.0


def test_profile_to_scoring_profile_handles_missing_preferences_flag() -> None:
    profile = PreferenceProfile(
        admission_number="ADM200",
        has_preferences=0,
        is_active=1,
    )

    result = profile_to_scoring_profile(profile)

    assert result.has_preferences is False
    assert result.q1_enc is None
    assert result.q10_enc is None


def test_profiles_to_scoring_profiles_preserves_order() -> None:
    profiles = [
        PreferenceProfile(admission_number="ADM001", has_preferences=1, is_active=1),
        PreferenceProfile(admission_number="ADM002", has_preferences=1, is_active=1),
    ]

    result = profiles_to_scoring_profiles(profiles)

    assert [profile.admission_number for profile in result] == ["ADM001", "ADM002"]
