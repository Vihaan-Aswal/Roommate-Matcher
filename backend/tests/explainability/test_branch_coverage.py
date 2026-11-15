"""Branch coverage for the explainability pipeline guard rails."""
from __future__ import annotations

import pytest

from app.services.explainability.consistency import _strength_magnitude, enforce_room_consistency
from app.services.explainability.contracts import HypotheticalGroupInput, RoomExplanationContext
from app.services.explainability.factor_classification import (
    _derive_weight_class,
    classify_factor_breakdown,
    validate_factor_keys,
)
from app.services.explainability.reason_selection import (
    ReasonCandidate,
    _compare_mismatch,
    _compare_positive,
    _mismatch_priority,
    _positive_priority,
    select_reason_candidates,
)
from app.services.explainability.room_aggregation import aggregate_student_factors
from app.services.explainability.service import (
    _merge_reason_candidates,
    explain_hypothetical_group,
    generate_explanation,
    generate_room_explanations,
)
from app.services.scoring.constants import SCORING_FACTOR_KEYS
from app.services.scoring.types import FactorScore, PairResult

from .conftest import build_pair_results


def _candidate(
    *,
    factor_key: str = "q1_enc",
    factor_class: str = "Strong Match",
    polarity: str = "strong_positive",
    raw_score: float = 0.9,
    weight_used: float = 0.1,
    reason_bucket: str = "sleep_alignment",
    claim_scope: str = "student_specific_claim",
    missing_data: bool = False,
) -> ReasonCandidate:
    return ReasonCandidate(
        factor_key=factor_key,
        reason_bucket=reason_bucket,
        factor_class=factor_class,
        polarity=polarity,
        raw_score=raw_score,
        weight_used=weight_used,
        claim_scope=claim_scope,
        missing_data=missing_data,
    )


def _context(
    students: list[str],
    pair_results: dict,
    *,
    labels: dict[str, str] | None = None,
    at_risk: dict[str, bool] | None = None,
    satisfaction: dict[str, float] | None = None,
    room_size: int | None = None,
) -> RoomExplanationContext:
    return RoomExplanationContext(
        segment_key="SEG_BRANCH",
        room_id="SEG_BRANCH_R1",
        room_size=room_size if room_size is not None else len(students),
        student_ids=students,
        pair_results=pair_results,
        student_satisfaction=satisfaction or {student: 0.75 for student in students},
        student_labels=labels or {student: "Good" for student in students},
        student_at_risk=at_risk or {student: False for student in students},
        reason_mode="assigned_room",
    )


# ---------------------------------------------------------------------------
# factor classification
# ---------------------------------------------------------------------------


def test_derive_weight_class_rejects_gap_weights() -> None:
    with pytest.raises(ValueError, match="Unsupported factor weight"):
        _derive_weight_class(0.075)


def test_validate_factor_keys_lists_missing_and_extra() -> None:
    with pytest.raises(ValueError, match="missing=.*extra="):
        validate_factor_keys({"q1_enc": FactorScore(1.0, 1.0, False)})
    with pytest.raises(ValueError, match="extra="):
        validate_factor_keys(
            {
                **{key: FactorScore(0.5, 1.0, False) for key in SCORING_FACTOR_KEYS},
                "unknown_factor": FactorScore(0.5, 1.0, False),
            }
        )


def test_classify_factor_rejects_unknown_factor() -> None:
    from app.services.explainability.factor_classification import classify_factor

    with pytest.raises(ValueError, match="Unknown factor key"):
        classify_factor("unknown", 0.5, weight_used=0.1, missing_data=False)


def test_classify_factor_breakdown_rejects_bad_shapes() -> None:
    with pytest.raises(ValueError, match="Invalid factor keys"):
        classify_factor_breakdown({"q1_enc": FactorScore(0.5, 1.0, False)})


# ---------------------------------------------------------------------------
# reason selection
# ---------------------------------------------------------------------------


def test_neutral_candidates_sort_last() -> None:
    neutral = _candidate(factor_class="Neutral", polarity="neutral_context")
    assert _positive_priority(neutral) == 2
    assert _mismatch_priority(neutral) == 2


def test_comparators_break_full_ties_deterministically() -> None:
    left = _candidate(factor_key="not_indexed_a")
    right = _candidate(factor_key="not_indexed_b")

    assert _compare_positive(left, right) == -1
    assert _compare_positive(right, left) == 1
    assert _compare_positive(left, left) == 0
    assert _compare_mismatch(left, right) == -1
    assert _compare_mismatch(right, left) == 1
    assert _compare_mismatch(left, left) == 0


def test_low_signal_moderate_matches_are_dropped_for_strong_labels() -> None:
    candidate = _candidate(factor_class="Moderate Match", polarity="moderate_positive", raw_score=0.4)
    assert select_reason_candidates("Good", [candidate]) == []


def test_okay_label_uses_two_mismatches_when_no_positive_exists() -> None:
    first = _candidate(
        factor_class="Strong Mismatch", polarity="mismatch", raw_score=0.0
    )
    second = _candidate(
        factor_key="q2_enc",
        reason_bucket="cleanliness_alignment",
        factor_class="Moderate Mismatch",
        polarity="mismatch",
        raw_score=0.2,
    )

    selected = select_reason_candidates("Okay", [first, second])

    assert selected == [first, second]


def test_unsupported_satisfaction_label_is_rejected() -> None:
    with pytest.raises(ValueError, match="Unsupported satisfaction label"):
        select_reason_candidates("Perfect", [])


def test_neutral_candidates_are_not_selected() -> None:
    neutral = _candidate(factor_class="Neutral", polarity="neutral_context")
    assert select_reason_candidates("Excellent", [neutral]) == []


# ---------------------------------------------------------------------------
# consistency
# ---------------------------------------------------------------------------


def test_neutral_candidate_has_zero_strength() -> None:
    assert _strength_magnitude(_candidate(factor_class="Neutral")) == 0.0


def test_negative_room_shared_winner_drops_positive_claims() -> None:
    positive = _candidate(
        factor_key="q1_enc",
        raw_score=0.85,
        weight_used=0.1,
        claim_scope="room_shared_claim",
        factor_class="Moderate Match",
        polarity="moderate_positive",
    )
    mismatch = _candidate(
        factor_key="q2_enc",
        raw_score=0.0,
        weight_used=0.2,
        claim_scope="room_shared_claim",
        factor_class="Strong Mismatch",
        polarity="mismatch",
    )
    also_mismatch = _candidate(
        factor_key="q3_enc",
        raw_score=0.2,
        weight_used=0.1,
        claim_scope="room_shared_claim",
        factor_class="Moderate Mismatch",
        polarity="mismatch",
    )

    retained = enforce_room_consistency(
        {
            "A": [positive, _candidate(claim_scope="student_specific_claim")],
            "B": [mismatch],
            "C": [also_mismatch],
        }
    )

    assert positive not in retained["A"]
    assert retained["A"], "student-specific reasons must survive"
    assert retained["B"] == [mismatch]
    assert retained["C"] == [also_mismatch]


# ---------------------------------------------------------------------------
# room aggregation
# ---------------------------------------------------------------------------


def test_aggregate_student_factors_rejects_bad_pair_breakdown() -> None:
    students = ["A", "B"]
    pair_results = build_pair_results(students)
    pair_results[("A", "B")] = PairResult(
        pair_score=0.5,
        factor_breakdown={"q1_enc": FactorScore(0.5, 1.0, False)},
        excellent_candidate=False,
    )

    with pytest.raises(ValueError, match="Invalid factor breakdown keys"):
        aggregate_student_factors(
            student_id="A", room_student_ids=students, pair_results=pair_results
        )


def test_aggregate_student_factors_rejects_missing_pair_and_unknown_student() -> None:
    students = ["A", "B"]
    with pytest.raises(ValueError, match="Missing pair result"):
        aggregate_student_factors(
            student_id="A", room_student_ids=students, pair_results={}
        )
    with pytest.raises(ValueError, match="is not in room_student_ids"):
        aggregate_student_factors(
            student_id="Z", room_student_ids=students, pair_results=build_pair_results(students)
        )


# ---------------------------------------------------------------------------
# service
# ---------------------------------------------------------------------------


def test_context_validation_guards_are_enforced() -> None:
    students = ["A", "B"]
    pairs = build_pair_results(students)

    with pytest.raises(ValueError, match="Unsupported room_size"):
        generate_room_explanations(_context(students, pairs, room_size=5))
    with pytest.raises(ValueError, match="does not match student count"):
        generate_room_explanations(_context(students, pairs, room_size=3))
    with pytest.raises(ValueError, match="student_ids must be unique"):
        generate_room_explanations(
            _context(["A", "A"], pairs, labels={"A": "Good"}, at_risk={"A": False}, satisfaction={"A": 0.75})
        )
    with pytest.raises(ValueError, match="student_satisfaction keys"):
        generate_room_explanations(
            _context(students, pairs, satisfaction={"A": 0.75})
        )
    with pytest.raises(ValueError, match="student_labels keys"):
        generate_room_explanations(_context(students, pairs, labels={"A": "Good"}))
    with pytest.raises(ValueError, match="student_at_risk keys"):
        generate_room_explanations(_context(students, pairs, at_risk={"A": False}))


def test_missing_pair_and_missing_factor_raise() -> None:
    from app.services.matching.errors import IncompletePairMatrixError

    students = ["A", "B"]
    with pytest.raises(ValueError, match="Missing pair result"):
        generate_room_explanations(_context(students, {}))
    with pytest.raises(IncompletePairMatrixError):
        explain_hypothetical_group(
            HypotheticalGroupInput(
                segment_key="SEG", room_size=2, student_ids=students, pair_results={}
            )
        )

    pairs = build_pair_results(students)
    pairs[("A", "B")] = PairResult(pair_score=0.5, factor_breakdown={}, excellent_candidate=False)
    with pytest.raises(ValueError, match="Invalid factor breakdown keys"):
        generate_room_explanations(_context(students, pairs))

    # A complete key set with a null factor value reaches the room-shared guard.
    trio = ["A", "B", "C"]
    trio_pairs = build_pair_results(trio)
    broken_breakdown = dict(trio_pairs[("A", "B")].factor_breakdown)
    broken_breakdown["q1_enc"] = None
    trio_pairs[("A", "B")] = PairResult(
        pair_score=0.5, factor_breakdown=broken_breakdown, excellent_candidate=False
    )
    with pytest.raises(ValueError, match="Missing factor q1_enc"):
        generate_room_explanations(_context(trio, trio_pairs, room_size=3))


def test_all_missing_data_falls_back_to_neutral_context_reasons() -> None:
    students = ["A", "B"]
    missing_everything = {key: 1.0 for key in SCORING_FACTOR_KEYS}
    pairs = build_pair_results(
        students,
        pair_missing_overrides={("A", "B"): set(SCORING_FACTOR_KEYS)},
    )
    assert missing_everything

    explanations = generate_room_explanations(_context(students, pairs))

    assert len(explanations) == 2
    for explanation in explanations:
        assert explanation.reasons
        assert explanation.factor_trace[0]["reason_bucket"] == "neutral_context_room"


def test_three_bed_room_aggregation_skips_fully_missing_factors() -> None:
    students = ["A", "B", "C"]
    pairs = build_pair_results(
        students,
        pair_missing_overrides={
            ("A", "B"): set(SCORING_FACTOR_KEYS),
            ("A", "C"): set(SCORING_FACTOR_KEYS),
            ("B", "C"): set(SCORING_FACTOR_KEYS),
        },
    )

    explanations = generate_room_explanations(_context(students, pairs, room_size=3))

    assert len(explanations) == 3
    assert all(explanation.reasons for explanation in explanations)


def test_merge_reason_candidates_dedupes_bucket_and_scope() -> None:
    primary = [_candidate(reason_bucket="sleep_alignment", claim_scope="room_shared_claim")]
    secondary = [_candidate(reason_bucket="sleep_alignment", claim_scope="room_shared_claim")]

    merged = _merge_reason_candidates(primary, secondary, max_reasons=3)

    assert merged == primary


def test_generate_explanation_rejects_student_outside_room() -> None:
    students = ["A", "B"]
    context = _context(students, build_pair_results(students))

    with pytest.raises(ValueError, match="is not in room context"):
        generate_explanation("Z", context)


def test_hypothetical_group_without_precomputed_scores_derives_them() -> None:
    students = ["A", "B"]
    pairs = build_pair_results(students, default_factor_score=0.8)

    explanations = explain_hypothetical_group(
        HypotheticalGroupInput(
            segment_key="SEG_HYP",
            room_size=2,
            student_ids=students,
            pair_results=pairs,
        )
    )

    assert [item.student_id for item in explanations] == students
    assert all(item.room_id.startswith("SEG_HYP_HYP_2_") for item in explanations)
    assert all(item.reasons for item in explanations)


def test_classify_factor_breakdown_accepts_a_complete_breakdown() -> None:
    from app.services.explainability.factor_classification import classify_factor_breakdown

    pairs = build_pair_results(["A", "B"], default_factor_score=0.9)
    classified = classify_factor_breakdown(pairs[("A", "B")].factor_breakdown)

    assert [item.factor_key for item in classified] == list(SCORING_FACTOR_KEYS)
    assert all(item.factor_class == "Strong Match" for item in classified)


def test_room_shared_aggregation_rejects_a_missing_room_edge() -> None:
    trio = ["A", "B", "C"]
    complete = build_pair_results(trio)
    partial = {("A", "B"): complete[("A", "B")], ("A", "C"): complete[("A", "C")]}

    with pytest.raises(ValueError, match="Missing pair result for room edge"):
        generate_room_explanations(_context(trio, partial, room_size=3))


def test_template_renderer_falls_back_when_bucket_lacks_the_family() -> None:
    from app.services.explainability.template_renderer import render_reason_lines

    neutral_room_usage = _candidate(
        factor_key="q4a_enc",
        reason_bucket="room_usage_alignment",
        factor_class="Neutral",
        polarity="neutral_context",
    )

    lines, traces = render_reason_lines(
        student_id="A", room_id="R1", selected_candidates=[neutral_room_usage]
    )

    assert lines, "the generic neutral template must render"
    assert traces[0].template_id.startswith("room_usage_alignment.neutral_context")


def test_template_renderer_ignores_blank_context_snippets() -> None:
    from app.services.explainability.template_renderer import render_reason_lines

    positive = _candidate(factor_class="Strong Match", polarity="strong_positive")

    lines, _ = render_reason_lines(
        student_id="A",
        room_id="R1",
        selected_candidates=[positive],
        context_snippets={"sleep_alignment": "   "},
    )

    assert lines
    assert not lines[0].endswith("   ")


def test_consistency_keeps_mismatches_when_no_positive_winner_exists() -> None:
    mismatch_a = _candidate(
        factor_key="q1_enc",
        factor_class="Moderate Mismatch",
        polarity="mismatch",
        raw_score=0.2,
        claim_scope="room_shared_claim",
    )
    mismatch_b = _candidate(
        factor_key="q2_enc",
        reason_bucket="cleanliness_alignment",
        factor_class="Strong Mismatch",
        polarity="mismatch",
        raw_score=0.1,
        claim_scope="room_shared_claim",
    )

    retained = enforce_room_consistency({"A": [mismatch_a], "B": [mismatch_b]})

    assert retained == {"A": [mismatch_a], "B": [mismatch_b]}
