from __future__ import annotations

from app.services.scoring.constants import FACTOR_BASE_WEIGHTS, SCORING_FACTOR_KEYS
from app.services.scoring.distance import score_q1_sleep, score_q2_cleanliness, score_q3_late_return, score_q9_budget
from app.services.scoring.labels import is_excellent_candidate
from app.services.scoring.matrix import score_q6_smoking, score_q7_drinking, score_q8_diet
from app.services.scoring.mismatch import score_q4_room_use, score_q5_night_activity, score_q10_lifestyle_tolerance
from app.services.scoring.types import FactorScore, PairResult, ScoringProfile


def _score_q1(profile_a: ScoringProfile, profile_b: ScoringProfile) -> tuple[float, bool]:
    if profile_a.q1_enc is None or profile_b.q1_enc is None:
        return 1.0, True
    return score_q1_sleep(profile_a.q1_enc, profile_b.q1_enc), False


def _score_q2(profile_a: ScoringProfile, profile_b: ScoringProfile) -> tuple[float, bool]:
    if profile_a.q2_enc is None or profile_b.q2_enc is None:
        return 1.0, True
    return score_q2_cleanliness(profile_a.q2_enc, profile_b.q2_enc), False


def _score_q3(profile_a: ScoringProfile, profile_b: ScoringProfile) -> tuple[float, bool]:
    if profile_a.q3_enc is None or profile_b.q3_enc is None:
        return 1.0, True
    return score_q3_late_return(profile_a.q3_enc, profile_b.q3_enc), False


def _score_q4(profile_a: ScoringProfile, profile_b: ScoringProfile) -> tuple[float, bool]:
    values = (profile_a.q4a_enc, profile_a.q4b_enc, profile_b.q4a_enc, profile_b.q4b_enc)
    if any(value is None for value in values):
        return 1.0, True

    return (
        score_q4_room_use(
            habit_a=profile_a.q4a_enc,
            comfort_a=profile_a.q4b_enc,
            habit_b=profile_b.q4a_enc,
            comfort_b=profile_b.q4b_enc,
        ),
        False,
    )


def _score_q5(profile_a: ScoringProfile, profile_b: ScoringProfile) -> tuple[float, bool]:
    values = (profile_a.q5a_enc, profile_a.q5b_enc, profile_b.q5a_enc, profile_b.q5b_enc)
    if any(value is None for value in values):
        return 1.0, True

    return (
        score_q5_night_activity(
            habit_a=profile_a.q5a_enc,
            comfort_a=profile_a.q5b_enc,
            habit_b=profile_b.q5a_enc,
            comfort_b=profile_b.q5b_enc,
        ),
        False,
    )


def _score_q6(profile_a: ScoringProfile, profile_b: ScoringProfile) -> tuple[float, bool]:
    if profile_a.q6_enc is None or profile_b.q6_enc is None:
        return 1.0, True
    return score_q6_smoking(profile_a.q6_enc, profile_b.q6_enc), False


def _score_q7(profile_a: ScoringProfile, profile_b: ScoringProfile) -> tuple[float, bool]:
    if profile_a.q7_enc is None or profile_b.q7_enc is None:
        return 1.0, True
    return score_q7_drinking(profile_a.q7_enc, profile_b.q7_enc), False


def _score_q8(profile_a: ScoringProfile, profile_b: ScoringProfile) -> tuple[float, bool]:
    if profile_a.q8_enc is None or profile_b.q8_enc is None:
        return 1.0, True
    return score_q8_diet(profile_a.q8_enc, profile_b.q8_enc), False


def _score_q9(profile_a: ScoringProfile, profile_b: ScoringProfile) -> tuple[float, bool]:
    if profile_a.q9_enc is None or profile_b.q9_enc is None:
        return 1.0, True
    return score_q9_budget(profile_a.q9_enc, profile_b.q9_enc), False


def _score_q10(profile_a: ScoringProfile, profile_b: ScoringProfile) -> tuple[float, bool]:
    if profile_a.q10_enc is None or profile_b.q10_enc is None:
        return 1.0, True
    return score_q10_lifestyle_tolerance(profile_a.q10_enc, profile_b.q10_enc), False


def _collect_raw_scores(profile_a: ScoringProfile, profile_b: ScoringProfile) -> dict[str, tuple[float, bool]]:
    return {
        "q1_enc": _score_q1(profile_a, profile_b),
        "q2_enc": _score_q2(profile_a, profile_b),
        "q3_enc": _score_q3(profile_a, profile_b),
        "q4a_enc": _score_q4(profile_a, profile_b),
        "q5a_enc": _score_q5(profile_a, profile_b),
        "q6_enc": _score_q6(profile_a, profile_b),
        "q7_enc": _score_q7(profile_a, profile_b),
        "q8_enc": _score_q8(profile_a, profile_b),
        "q9_enc": _score_q9(profile_a, profile_b),
        "q10_enc": _score_q10(profile_a, profile_b),
    }


def compute_pair_score(profile_a: ScoringProfile, profile_b: ScoringProfile) -> PairResult:
    raw_scores = _collect_raw_scores(profile_a, profile_b)

    valid_factor_keys = [key for key, (_, missing) in raw_scores.items() if not missing]
    if not valid_factor_keys:
        zeroed_breakdown = {
            factor_key: FactorScore(raw_score=0.0, weight_used=0.0, missing_data=True)
            for factor_key in SCORING_FACTOR_KEYS
        }
        return PairResult(pair_score=0.0, factor_breakdown=zeroed_breakdown, excellent_candidate=False)

    valid_base_weight_sum = sum(FACTOR_BASE_WEIGHTS[key] for key in valid_factor_keys)

    factor_breakdown: dict[str, FactorScore] = {}
    for factor_key in SCORING_FACTOR_KEYS:
        raw_score, is_missing = raw_scores[factor_key]
        weight_used = 0.0 if is_missing else (FACTOR_BASE_WEIGHTS[factor_key] / valid_base_weight_sum)
        factor_breakdown[factor_key] = FactorScore(
            raw_score=raw_score,
            weight_used=weight_used,
            missing_data=is_missing,
        )

    pair_score = sum(item.raw_score * item.weight_used for item in factor_breakdown.values())
    pair_score = min(max(pair_score, 0.0), 1.0)

    return PairResult(
        pair_score=pair_score,
        factor_breakdown=factor_breakdown,
        excellent_candidate=is_excellent_candidate(pair_score, factor_breakdown),
    )
