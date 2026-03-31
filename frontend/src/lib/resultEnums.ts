import type {
  FactorClaimScope,
  FactorClass,
  FactorPolarity,
  SatisfactionLabel,
} from "./apiClient";

export const SATISFACTION_LABELS: SatisfactionLabel[] = [
  "Excellent",
  "Good",
  "Okay",
  "Poor",
];

export const FACTOR_CLASSES: FactorClass[] = [
  "Strong Match",
  "Moderate Match",
  "Neutral",
  "Moderate Mismatch",
  "Strong Mismatch",
];

export const FACTOR_POLARITIES: FactorPolarity[] = [
  "strong_positive",
  "moderate_positive",
  "neutral_context",
  "mismatch",
];

export const FACTOR_CLAIM_SCOPES: FactorClaimScope[] = [
  "room_shared_claim",
  "student_specific_claim",
];

export function isSatisfactionLabel(value: string): value is SatisfactionLabel {
  return SATISFACTION_LABELS.includes(value as SatisfactionLabel);
}
