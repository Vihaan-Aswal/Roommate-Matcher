// @vitest-environment node
import { describe, expect, it } from "vitest";

import { sanitizeReasonText } from "../../lib/privacySafeRender";

const REDACTED = "Lifestyle preference alignment affects compatibility in this group.";

describe("sanitizeReasonText", () => {
  it("leaves a reason with no lifestyle term untouched", () => {
    const reason = "Both students keep the same sleep schedule and study hours.";

    expect(sanitizeReasonText(reason)).toEqual({ text: reason, wasRedacted: false });
  });

  it("redacts every blocked lifestyle term, whatever the casing", () => {
    for (const reason of [
      "One student will smoke in the room.",
      "SMOKING is not allowed.",
      "Alcohol is consumed on weekends.",
      "They were drinking at the party.",
      "A drink before bed.",
      "Both are vegetarian.",
      "One is non-vegetarian.",
      "One is non vegetarian.",
      "They cook meat in the room.",
      "The diet differs.",
    ]) {
      expect(sanitizeReasonText(reason)).toEqual({ text: REDACTED, wasRedacted: true });
    }
  });

  it("matches whole words only, so unrelated words survive", () => {
    for (const reason of [
      "The smokescreen made the corridor dark.",
      "The dietary plan is posted on the wall.",
      "The meatball recipe is in the shared kitchen.",
      "Water refill is on the first floor.",
    ]) {
      expect(sanitizeReasonText(reason)).toEqual({ text: reason, wasRedacted: false });
    }
  });

  it("handles a reason containing regular-expression characters without throwing", () => {
    const reason = "Score gap (0.42) [small] + stable * routine? Yes.";

    expect(sanitizeReasonText(reason)).toEqual({ text: reason, wasRedacted: false });
  });

  it("returns the placeholder once, even when several terms are present", () => {
    const result = sanitizeReasonText("Smoking, drinking and meat are all mentioned.");

    expect(result.wasRedacted).toBe(true);
    expect(result.text).toBe(REDACTED);
  });

  it("treats an empty reason as safe", () => {
    expect(sanitizeReasonText("")).toEqual({ text: "", wasRedacted: false });
  });
});
