// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  FACTOR_CLAIM_SCOPES,
  FACTOR_CLASSES,
  FACTOR_POLARITIES,
  SATISFACTION_LABELS,
} from "../../lib/resultEnums";

describe("result enums", () => {
  it("lists the satisfaction labels in display order", () => {
    expect(SATISFACTION_LABELS).toEqual(["Excellent", "Good", "Okay", "Poor"]);
  });

  it("lists the factor classes in display order", () => {
    expect(FACTOR_CLASSES).toEqual([
      "Strong Match",
      "Moderate Match",
      "Neutral",
      "Moderate Mismatch",
      "Strong Mismatch",
    ]);
  });

  it("lists every factor polarity exactly once", () => {
    expect(FACTOR_POLARITIES).toEqual([
      "strong_positive",
      "moderate_positive",
      "neutral_context",
      "mismatch",
    ]);
    expect(new Set(FACTOR_POLARITIES).size).toBe(FACTOR_POLARITIES.length);
  });

  it("lists both claim scopes", () => {
    expect(FACTOR_CLAIM_SCOPES).toEqual(["room_shared_claim", "student_specific_claim"]);
  });

  it("keeps the label sets deduplicated", () => {
    expect(new Set(SATISFACTION_LABELS).size).toBe(SATISFACTION_LABELS.length);
    expect(new Set(FACTOR_CLASSES).size).toBe(FACTOR_CLASSES.length);
    expect(new Set(FACTOR_CLAIM_SCOPES).size).toBe(FACTOR_CLAIM_SCOPES.length);
  });
});
