from __future__ import annotations

from typing import Literal

from app.services.explainability.contracts import FactorClass
from app.services.scoring.constants import FACTOR_BASE_WEIGHTS, SCORING_FACTOR_KEYS

EPSILON = 1e-9

FactorWeightClass = Literal["heavy", "medium", "light"]

HEAVY_WEIGHT_MIN = 0.15
MEDIUM_WEIGHT_MIN = 0.10
MEDIUM_WEIGHT_MAX = 0.15
LIGHT_WEIGHT_MAX = 0.05

THRESHOLD_TABLES: dict[FactorWeightClass, tuple[tuple[FactorClass, float], ...]] = {
    "heavy": (
        ("Strong Match", 0.90),
        ("Moderate Match", 0.70),
        ("Neutral", 0.55),
        ("Moderate Mismatch", 0.30),
        ("Strong Mismatch", 0.00),
    ),
    "medium": (
        ("Strong Match", 0.85),
        ("Moderate Match", 0.65),
        ("Neutral", 0.45),
        ("Moderate Mismatch", 0.25),
        ("Strong Mismatch", 0.00),
    ),
    "light": (
        ("Strong Match", 0.80),
        ("Moderate Match", 0.60),
        ("Neutral", 0.40),
        ("Moderate Mismatch", 0.20),
        ("Strong Mismatch", 0.00),
    ),
}


def _derive_weight_class(weight: float) -> FactorWeightClass:
    if weight >= HEAVY_WEIGHT_MIN:
        return "heavy"
    if MEDIUM_WEIGHT_MIN <= weight < MEDIUM_WEIGHT_MAX:
        return "medium"
    if weight <= LIGHT_WEIGHT_MAX:
        return "light"
    raise ValueError(f"Unsupported factor weight for classification: {weight}")


WEIGHT_CLASS_BY_FACTOR: dict[str, FactorWeightClass] = {
    factor_key: _derive_weight_class(FACTOR_BASE_WEIGHTS[factor_key])
    for factor_key in SCORING_FACTOR_KEYS
}


def classify_score_for_weight_class(weight_class: FactorWeightClass, raw_score: float) -> FactorClass:
    normalized_score = min(max(raw_score, 0.0), 1.0)
    for factor_class, lower_bound in THRESHOLD_TABLES[weight_class]:
        if normalized_score + EPSILON >= lower_bound:
            return factor_class
    return "Strong Mismatch"
