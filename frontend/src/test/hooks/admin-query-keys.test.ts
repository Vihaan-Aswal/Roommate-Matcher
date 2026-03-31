import { adminQueryKeys } from "../../hooks/adminQueryKeys";

describe("adminQueryKeys", () => {
  it("builds run and segment scoped keys", () => {
    expect(adminQueryKeys.roomsByRunSegment("run-1", "SEG_A")).toEqual([
      "admin",
      "matching-rooms",
      "run-1",
      "SEG_A",
    ]);

    expect(adminQueryKeys.studentsByRunSegment("run-1", "SEG_A")).toEqual([
      "admin",
      "matching-students",
      "run-1",
      "SEG_A",
    ]);

    expect(adminQueryKeys.fairnessByRun("run-1")).toEqual([
      "admin",
      "fairness",
      "run-1",
    ]);
  });

  it("produces distinct keys for different segments", () => {
    expect(
      adminQueryKeys.roomsByRunSegment("run-1", "SEG_A").join("|"),
    ).not.toEqual(
      adminQueryKeys.roomsByRunSegment("run-1", "SEG_B").join("|"),
    );
  });
});
