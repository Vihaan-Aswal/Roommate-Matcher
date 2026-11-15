// @vitest-environment node
import { describe, expect, it } from "vitest";

import { hasReadableSegmentLabel, segmentLabel } from "../lib/segmentLabel";

describe("segmentLabel", () => {
  it("uses the API fields when the endpoint provides them", () => {
    expect(
      segmentLabel({
        segment_key: "F_1st_year_NonAC_3",
        gender: "F",
        year_group: "1st_year",
        ac_type: "NonAC",
        room_size: 3,
      }),
    ).toBe("Female · 1st year · Non-AC · 3-bed");
  });

  it("reads the key when only the key is available", () => {
    expect(segmentLabel({ segment_key: "M_2nd_to_4th_AC_2" })).toBe(
      "Male · 2nd to 4th year · AC · 2-bed",
    );
    expect(segmentLabel({ segment_key: "F_2nd_to_4th_NonAC_4" })).toBe(
      "Female · 2nd to 4th year · Non-AC · 4-bed",
    );
  });

  it("never invents a label for a key it cannot read", () => {
    const unknown = { segment_key: "legacy-segment-a" };
    expect(segmentLabel(unknown)).toBe("legacy-segment-a");
    expect(hasReadableSegmentLabel(unknown)).toBe(false);
    expect(hasReadableSegmentLabel({ segment_key: "F_1st_year_NonAC_3" })).toBe(true);
  });

  it("keeps the raw key out of the label for every known shape", () => {
    for (const key of [
      "F_1st_year_NonAC_3",
      "M_2nd_to_4th_AC_2",
      "F_2nd_to_4th_AC_2",
      "M_1st_year_NonAC_4",
    ]) {
      expect(segmentLabel({ segment_key: key })).not.toMatch(/_1st_year|_2nd_to_4th|NonAC/);
    }
  });
});
