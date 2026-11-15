// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  formatScorePercent,
  roomHealthLabel,
  summarizeReasons,
} from "../../lib/resultPresentation";

describe("formatScorePercent", () => {
  it("renders one decimal place", () => {
    expect(formatScorePercent(0)).toBe("0.0%");
    expect(formatScorePercent(0.5)).toBe("50.0%");
    expect(formatScorePercent(1)).toBe("100.0%");
  });

  it("rounds to the nearest tenth of a percent", () => {
    expect(formatScorePercent(0.8567)).toBe("85.7%");
    expect(formatScorePercent(0.1234)).toBe("12.3%");
  });
});

describe("roomHealthLabel", () => {
  it("flags a room that needs review", () => {
    expect(roomHealthLabel(true)).toBe("Needs Review");
  });

  it("calls a room healthy when nothing is flagged", () => {
    expect(roomHealthLabel(false)).toBe("Healthy");
  });
});

describe("summarizeReasons", () => {
  it("shows nothing and counts nothing for an empty list", () => {
    expect(summarizeReasons([])).toEqual({ visibleReasons: [], overflowCount: 0 });
  });

  it("shows a single reason without an overflow", () => {
    expect(summarizeReasons(["Same sleep schedule"])).toEqual({
      visibleReasons: ["Same sleep schedule"],
      overflowCount: 0,
    });
  });

  it("shows exactly two reasons without an overflow", () => {
    expect(summarizeReasons(["a", "b"])).toEqual({
      visibleReasons: ["a", "b"],
      overflowCount: 0,
    });
  });

  it("caps the visible list at two and counts the rest", () => {
    expect(summarizeReasons(["a", "b", "c", "d"])).toEqual({
      visibleReasons: ["a", "b"],
      overflowCount: 2,
    });
  });

  it("does not mutate the input list", () => {
    const reasons = ["a", "b", "c"];

    summarizeReasons(reasons);

    expect(reasons).toEqual(["a", "b", "c"]);
  });
});
