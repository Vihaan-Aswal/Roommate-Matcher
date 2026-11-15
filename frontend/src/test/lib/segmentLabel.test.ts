// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  hasReadableSegmentLabel,
  segmentLabel,
  type SegmentIdentity,
} from "../../lib/segmentLabel";

describe("segmentLabel — field normalisation", () => {
  it("transforms each gender spelling and falls back to a capitalised word", () => {
    const cases: Array<[string, string]> = [
      ["F", "Female"],
      ["female", "Female"],
      ["M", "Male"],
      ["male", "Male"],
      ["O", "Other"],
      ["other", "Other"],
      ["Mixed", "Mixed"],
      ["transgender", "Transgender"],
    ];

    for (const [gender, expected] of cases) {
      expect(
        segmentLabel({ segment_key: "unknown", gender, year_group: "1st_year", ac_type: "AC", room_size: 2 }),
      ).toBe(`${expected} · 1st year · AC · 2-bed`);
    }
  });

  it("transforms each AC spelling", () => {
    expect(segmentLabel({ segment_key: "k", ac_type: "AC" })).toBe("AC");
    expect(segmentLabel({ segment_key: "k", ac_type: "ac" })).toBe("AC");
    expect(segmentLabel({ segment_key: "k", ac_type: "Non-AC" })).toBe("Non-AC");
    expect(segmentLabel({ segment_key: "k", ac_type: "Non AC" })).toBe("Non-AC");
    expect(segmentLabel({ segment_key: "k", ac_type: "NonAC" })).toBe("Non-AC");
    // Unknown values pass through rather than being guessed at.
    expect(segmentLabel({ segment_key: "k", ac_type: "cooled" })).toBe("cooled");
  });

  it("normalises the year group and adds the unit once", () => {
    expect(segmentLabel({ segment_key: "k", year_group: "1st_year" })).toBe("1st year");
    expect(segmentLabel({ segment_key: "k", year_group: "3rd year" })).toBe("3rd year");
    expect(segmentLabel({ segment_key: "k", year_group: "2nd" })).toBe("2nd year");
    expect(segmentLabel({ segment_key: "k", year_group: "Final_Year" })).toBe("final year");
  });

  it("omits a zero room size instead of rendering 0-bed", () => {
    expect(segmentLabel({ segment_key: "k", gender: "F", room_size: 0 })).toBe("Female");
    expect(segmentLabel({ segment_key: "k", gender: "F", room_size: null })).toBe("Female");
  });

  it("prefers the API fields over the fields encoded in the key", () => {
    expect(
      segmentLabel({
        segment_key: "M_2nd_to_4th_AC_2",
        gender: "F",
        year_group: "1st_year",
        ac_type: "NonAC",
        room_size: 3,
      }),
    ).toBe("Female · 1st year · Non-AC · 3-bed");
  });
});

describe("segmentLabel — keys that cannot be read", () => {
  const unreadable: SegmentIdentity[] = [
    { segment_key: "F" },
    { segment_key: "F_AC_3" },
    { segment_key: "F_1st_year_NonAC_notanumber" },
    { segment_key: "F_1st_year_NonAC_3_extra" },
    { segment_key: "legacy-segment-a" },
  ];

  it("echoes the key rather than inventing a label", () => {
    for (const segment of unreadable) {
      expect(segmentLabel(segment)).toBe(segment.segment_key);
      expect(hasReadableSegmentLabel(segment)).toBe(false);
    }
  });

  it("still translates the parts it can read from API fields when the key is odd", () => {
    expect(segmentLabel({ segment_key: "legacy", gender: "M", room_size: 2 })).toBe("Male · 2-bed");
  });

  it("reports a readable label only when the key was actually translated", () => {
    expect(hasReadableSegmentLabel({ segment_key: "F_1st_year_NonAC_3" })).toBe(true);
    expect(hasReadableSegmentLabel({ segment_key: "legacy", gender: "F" })).toBe(true);
  });
});
