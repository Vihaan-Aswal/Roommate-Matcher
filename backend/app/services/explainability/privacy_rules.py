from __future__ import annotations

import re


class PrivacyViolationError(ValueError):
    pass


SENSITIVE_FACTOR_KEYS: frozenset[str] = frozenset({"q6_enc", "q7_enc", "q8_enc"})

allowed_sensitive_phrases: tuple[str, ...] = (
    "lifestyle preferences",
    "lifestyle habits",
    "lifestyle differences",
    "lifestyle routines",
)

blocked_sensitive_lexicon: tuple[str, ...] = (
    "smoker",
    "smoking",
    "drinker",
    "drinking",
    "non-veg",
    "non veg",
    "vegetarian",
    "vegan",
    "alcohol",
    "nicotine",
    "cigarette",
)


def is_sensitive_factor(factor_key: str) -> bool:
    return factor_key in SENSITIVE_FACTOR_KEYS


def validate_privacy_text(lines: list[str]) -> None:
    for line in lines:
        lowered = line.lower()
        for blocked_term in blocked_sensitive_lexicon:
            # Token-aware matching avoids false positives from unrelated substrings.
            pattern = rf"(?<![a-z0-9]){re.escape(blocked_term)}(?![a-z0-9])"
            if re.search(pattern, lowered):
                raise PrivacyViolationError(
                    f"Blocked sensitive term found in explanation text: {blocked_term}"
                )
