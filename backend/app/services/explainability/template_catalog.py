from __future__ import annotations

TemplateFamily = str
SensitivityMode = str
ReasonBucket = str

TEMPLATE_CATALOG: dict[ReasonBucket, dict[SensitivityMode, dict[TemplateFamily, tuple[str, ...]]]] = {
    "_generic": {
        "non_sensitive": {
            "strong_positive": (
                "This area stands out as a clear strength for day-to-day compatibility.",
                "You are strongly aligned on this part of shared living.",
            ),
            "moderate_positive": (
                "This area shows a workable level of compatibility.",
                "You have a constructive level of alignment here.",
            ),
            "mismatch": (
                "This area may need a little coordination to keep routines smooth.",
                "A small adjustment in this area may help the room work better.",
            ),
            "neutral_context": (
                "Overall, the room has a mix of strengths and trade-offs.",
                "This room has a balanced profile with some clear adjustments to manage.",
            ),
        },
        "sensitive_generic": {
            "strong_positive": (
                "Your broader lifestyle preferences appear strongly compatible.",
                "Lifestyle-related routines look strongly aligned overall.",
            ),
            "moderate_positive": (
                "Your broader lifestyle preferences look reasonably compatible.",
                "Lifestyle-related routines appear moderately aligned.",
            ),
            "mismatch": (
                "There may be some lifestyle adjustments to work through as a room.",
                "Lifestyle differences may require a bit of extra coordination.",
            ),
            "neutral_context": (
                "Lifestyle compatibility here looks mixed and manageable with communication.",
                "Lifestyle preferences are varied in this room, so expectations matter.",
            ),
        },
    },
    "sleep_alignment": {
        "non_sensitive": {
            "strong_positive": (
                "Your sleep schedule alignment is a strong match.",
                "You appear highly aligned on sleep timing.",
            ),
            "moderate_positive": (
                "Your sleep schedule alignment looks reasonably compatible.",
                "Sleep timing appears compatible with minor variation.",
            ),
            "mismatch": (
                "Sleep schedules may need coordination to avoid routine friction.",
                "Differences in sleep timing may require a shared quiet-hours plan.",
            ),
        }
    },
    "cleanliness_alignment": {
        "non_sensitive": {
            "strong_positive": (
                "Cleanliness expectations are strongly aligned across roommates.",
                "You are strongly aligned on cleanliness expectations.",
            ),
            "moderate_positive": (
                "Cleanliness expectations are reasonably aligned.",
                "Cleanliness preferences look compatible with minor adjustment.",
            ),
            "mismatch": (
                "Differences in cleanliness preferences may need clear room norms.",
                "A shared cleaning routine may help with differing cleanliness expectations.",
            ),
        }
    },
    "late_return_alignment": {
        "non_sensitive": {
            "strong_positive": (
                "Late-return routines appear strongly aligned.",
                "You are strongly aligned on late-evening return patterns.",
            ),
            "moderate_positive": (
                "Late-return routines look reasonably aligned.",
                "Return-time expectations appear compatible overall.",
            ),
            "mismatch": (
                "Differences in return-time routines may require expectation setting.",
                "Late-evening routine differences may need a shared plan.",
            ),
        }
    },
    "room_usage_alignment": {
        "non_sensitive": {
            "strong_positive": (
                "Room usage habits and comfort expectations align very well.",
                "You are strongly aligned on room usage patterns.",
            ),
            "moderate_positive": (
                "Room usage habits look generally compatible.",
                "Room usage expectations are moderately aligned.",
            ),
            "mismatch": (
                "Room usage habits may need clearer boundaries and timing.",
                "Differences in room usage patterns may require a shared routine.",
            ),
        }
    },
    "night_activity_alignment": {
        "non_sensitive": {
            "strong_positive": (
                "Night-time activity preferences are strongly aligned.",
                "You appear highly aligned on night-time routines.",
            ),
            "moderate_positive": (
                "Night-time routines are reasonably compatible.",
                "Night activity preferences look workable together.",
            ),
            "mismatch": (
                "Night-time routine differences may require a quiet-hours agreement.",
                "A shared night routine may help reduce friction.",
            ),
        }
    },
    "sensitive_lifestyle": {
        "sensitive_generic": {
            "strong_positive": (
                "Broader lifestyle preferences in this room appear strongly compatible.",
                "Lifestyle habits are strongly aligned for this room.",
            ),
            "moderate_positive": (
                "Broader lifestyle preferences look reasonably compatible.",
                "Lifestyle habits appear moderately aligned overall.",
            ),
            "mismatch": (
                "Some lifestyle preferences may need active coordination among roommates.",
                "Lifestyle differences in this room may require clear expectations.",
            ),
        }
    },
    "budget_alignment": {
        "non_sensitive": {
            "strong_positive": (
                "Budget expectations are strongly aligned.",
                "You are highly aligned on budget comfort.",
            ),
            "moderate_positive": (
                "Budget expectations are reasonably aligned.",
                "Budget comfort levels look broadly compatible.",
            ),
            "mismatch": (
                "Budget expectation gaps may need clear upfront planning.",
                "A shared budgeting plan may help with expectation differences.",
            ),
        }
    },
    "lifestyle_tolerance": {
        "non_sensitive": {
            "strong_positive": (
                "Tolerance for day-to-day differences is strongly aligned.",
                "You are strongly aligned on handling lifestyle differences.",
            ),
            "moderate_positive": (
                "Tolerance for differences looks reasonably aligned.",
                "You appear moderately aligned on flexibility with roommate differences.",
            ),
            "mismatch": (
                "Different tolerance levels may require explicit communication norms.",
                "A shared approach to conflict resolution may help here.",
            ),
        }
    },
    "neutral_context_room": {
        "non_sensitive": {
            "neutral_context": (
                "Overall, this room can work with clear expectations and communication.",
                "This room has mixed signals, so a shared routine will matter.",
            )
        }
    },
}
