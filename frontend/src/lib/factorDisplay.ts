import type { FactorTraceEntry } from "./apiClient";

const FACTOR_LABELS: Record<string, string> = {
  q1_enc: "Sleep schedule",
  q2_enc: "Room tidiness",
  q3_enc: "Wake-up routine",
  q4a_enc: "Room social style",
  q4b_enc: "Guest comfort",
  q5a_enc: "Noise tolerance",
  q5b_enc: "Study environment",
  q6_enc: "Lifestyle alignment",
  q7_enc: "Lifestyle alignment",
  q8_enc: "Lifestyle alignment",
  q9_enc: "Budget preference",
  q10_enc: "Similarity preference",
};

export function getSafeFactorLabel(factorKey: string): string {
  return FACTOR_LABELS[factorKey] ?? "Compatibility factor";
}

export function factorPolarityIndicator(
  trace: FactorTraceEntry,
): "positive" | "neutral" | "warning" {
  if (
    trace.polarity === "strong_positive" ||
    trace.polarity === "moderate_positive"
  ) {
    return "positive";
  }

  if (trace.polarity === "neutral_context") {
    return "neutral";
  }

  return "warning";
}
