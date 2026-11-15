// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { FactorTraceEntry } from "../../lib/apiClient";
import {
  factorPolarityIndicator,
  getSafeFactorLabel,
} from "../../lib/factorDisplay";

function trace(polarity: FactorTraceEntry["polarity"]): FactorTraceEntry {
  return {
    factor_key: "q1_enc",
    factor_class: "Strong Match",
    reason_bucket: "sleep",
    polarity,
    template_id: "sleep-aligned",
    claim_scope: "room_shared_claim",
  };
}

describe("getSafeFactorLabel", () => {
  it("names each known compatibility factor", () => {
    expect(getSafeFactorLabel("q1_enc")).toBe("Sleep schedule");
    expect(getSafeFactorLabel("q2_enc")).toBe("Room tidiness");
    expect(getSafeFactorLabel("q3_enc")).toBe("Wake-up routine");
    expect(getSafeFactorLabel("q4a_enc")).toBe("Room social style");
    expect(getSafeFactorLabel("q4b_enc")).toBe("Guest comfort");
    expect(getSafeFactorLabel("q5a_enc")).toBe("Noise tolerance");
    expect(getSafeFactorLabel("q5b_enc")).toBe("Study environment");
    expect(getSafeFactorLabel("q6_enc")).toBe("Lifestyle alignment");
    expect(getSafeFactorLabel("q7_enc")).toBe("Lifestyle alignment");
    expect(getSafeFactorLabel("q8_enc")).toBe("Lifestyle alignment");
    expect(getSafeFactorLabel("q9_enc")).toBe("Budget preference");
    expect(getSafeFactorLabel("q10_enc")).toBe("Similarity preference");
  });

  it("never leaks an unknown encoded key into the UI", () => {
    expect(getSafeFactorLabel("q99_enc")).toBe("Compatibility factor");
    expect(getSafeFactorLabel("internal_score_expression")).toBe("Compatibility factor");
    expect(getSafeFactorLabel("")).toBe("Compatibility factor");
  });
});

describe("factorPolarityIndicator", () => {
  it("maps strong and moderate positives to the positive indicator", () => {
    expect(factorPolarityIndicator(trace("strong_positive"))).toBe("positive");
    expect(factorPolarityIndicator(trace("moderate_positive"))).toBe("positive");
  });

  it("maps neutral context to the neutral indicator", () => {
    expect(factorPolarityIndicator(trace("neutral_context"))).toBe("neutral");
  });

  it("maps a mismatch to the warning indicator", () => {
    expect(factorPolarityIndicator(trace("mismatch"))).toBe("warning");
  });
});
