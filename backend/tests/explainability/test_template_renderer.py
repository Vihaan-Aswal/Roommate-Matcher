from __future__ import annotations

from app.services.explainability.reason_selection import ReasonCandidate
from app.services.explainability.template_catalog import TEMPLATE_CATALOG
from app.services.explainability.template_renderer import render_reason_lines, stable_hash


def _reason(
    factor_key: str,
    reason_bucket: str,
    factor_class: str,
    polarity: str,
    *,
    raw_score: float = 0.9,
    weight_used: float = 0.1,
    claim_scope: str = "student_specific_claim",
) -> ReasonCandidate:
    return ReasonCandidate(
        factor_key=factor_key,
        reason_bucket=reason_bucket,
        factor_class=factor_class,
        polarity=polarity,
        raw_score=raw_score,
        weight_used=weight_used,
        claim_scope=claim_scope,
        missing_data=False,
    )


def test_stable_hash_is_repeatable_and_slot_sensitive() -> None:
    first = stable_hash("S01", "ROOM_1", "sleep_alignment", 0)
    second = stable_hash("S01", "ROOM_1", "sleep_alignment", 0)
    third = stable_hash("S01", "ROOM_1", "sleep_alignment", 1)

    assert first == second
    assert first != third


def test_renderer_is_deterministic_for_same_inputs() -> None:
    selected = [
        _reason("q1_enc", "sleep_alignment", "Strong Match", "strong_positive"),
        _reason("q2_enc", "cleanliness_alignment", "Moderate Match", "moderate_positive"),
    ]

    lines_a, trace_a = render_reason_lines(
        student_id="S01",
        room_id="R1",
        selected_candidates=selected,
    )
    lines_b, trace_b = render_reason_lines(
        student_id="S01",
        room_id="R1",
        selected_candidates=selected,
    )

    assert lines_a == lines_b
    assert trace_a == trace_b


def test_renderer_dedupes_duplicate_text_lines(monkeypatch) -> None:
    monkeypatch.setitem(
        TEMPLATE_CATALOG["sleep_alignment"]["non_sensitive"],
        "strong_positive",
        ("Same deterministic line.",),
    )

    selected = [
        _reason("q1_enc", "sleep_alignment", "Strong Match", "strong_positive"),
        _reason("q2_enc", "sleep_alignment", "Strong Match", "strong_positive"),
    ]
    lines, traces = render_reason_lines(
        student_id="S01",
        room_id="R1",
        selected_candidates=selected,
    )

    assert lines == ["Same deterministic line."]
    assert len(traces) == 1


def test_renderer_appends_context_snippet_for_non_sensitive_buckets() -> None:
    selected = [_reason("q1_enc", "sleep_alignment", "Strong Match", "strong_positive")]
    lines, _ = render_reason_lines(
        student_id="S01",
        room_id="R1",
        selected_candidates=selected,
        context_snippets={"sleep_alignment": "Shared quiet hours look realistic."},
    )

    assert "Shared quiet hours look realistic." in lines[0]


def test_renderer_falls_back_to_generic_templates_when_bucket_is_unknown() -> None:
    selected = [_reason("q1_enc", "unknown_bucket", "Moderate Match", "moderate_positive")]
    lines, _ = render_reason_lines(
        student_id="S01",
        room_id="R1",
        selected_candidates=selected,
    )

    assert lines[0] in TEMPLATE_CATALOG["_generic"]["non_sensitive"]["moderate_positive"]
