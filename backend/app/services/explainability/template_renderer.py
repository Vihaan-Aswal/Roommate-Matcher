from __future__ import annotations

import hashlib

from app.services.explainability.contracts import ReasonTrace
from app.services.explainability.reason_selection import ReasonCandidate
from app.services.explainability.template_catalog import TEMPLATE_CATALOG


def stable_hash(student_id: str, room_id: str, reason_bucket: str, slot_index: int) -> int:
    payload = f"{student_id}|{room_id}|{reason_bucket}|{slot_index}"
    digest = hashlib.sha256(payload.encode("utf-8")).digest()
    return int.from_bytes(digest[0:8], byteorder="big", signed=False)


def _family_for_candidate(candidate: ReasonCandidate) -> str:
    if candidate.polarity in {"strong_positive", "moderate_positive", "neutral_context"}:
        return candidate.polarity
    return "mismatch"


def _sensitivity_mode(candidate: ReasonCandidate) -> str:
    if candidate.reason_bucket == "sensitive_lifestyle":
        return "sensitive_generic"
    return "non_sensitive"


def _variants_for_candidate(candidate: ReasonCandidate) -> tuple[str, ...]:
    family = _family_for_candidate(candidate)
    mode = _sensitivity_mode(candidate)

    bucket_templates = TEMPLATE_CATALOG.get(candidate.reason_bucket)
    if bucket_templates is not None:
        mode_templates = bucket_templates.get(mode)
        if mode_templates and family in mode_templates:
            return mode_templates[family]

    return TEMPLATE_CATALOG["_generic"][mode][family]


def render_reason_lines(
    *,
    student_id: str,
    room_id: str,
    selected_candidates: list[ReasonCandidate],
    context_snippets: dict[str, str] | None = None,
) -> tuple[list[str], list[ReasonTrace]]:
    rendered_lines: list[str] = []
    traces: list[ReasonTrace] = []
    seen_lines: set[str] = set()

    for slot_index, candidate in enumerate(selected_candidates):
        family = _family_for_candidate(candidate)
        variants = _variants_for_candidate(candidate)

        variant_index = stable_hash(student_id, room_id, candidate.reason_bucket, slot_index) % len(variants)
        line = variants[variant_index]

        if context_snippets and candidate.reason_bucket in context_snippets and _sensitivity_mode(candidate) == "non_sensitive":
            context_suffix = context_snippets[candidate.reason_bucket].strip()
            if context_suffix:
                line = f"{line} {context_suffix}"

        if line in seen_lines:
            continue

        seen_lines.add(line)
        rendered_lines.append(line)

        template_id = f"{candidate.reason_bucket}.{family}.{variant_index + 1}"
        traces.append(
            ReasonTrace(
                factor_key=candidate.factor_key,
                factor_class=candidate.factor_class,
                reason_bucket=candidate.reason_bucket,
                polarity=family,
                template_id=template_id,
                claim_scope=candidate.claim_scope,
            )
        )

    return rendered_lines, traces
