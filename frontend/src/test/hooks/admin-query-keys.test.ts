import { adminQueryKeys } from "../../hooks/adminQueryKeys";

describe("adminQueryKeys", () => {
  const workspaceId = "ws_test";

  it("builds run and segment scoped keys", () => {
    expect(adminQueryKeys.roomsByRunSegment(workspaceId, "run-1", "SEG_A")).toEqual([
      "admin",
      workspaceId,
      "matching-rooms",
      "run-1",
      "SEG_A",
    ]);

    expect(adminQueryKeys.studentsByRunSegment(workspaceId, "run-1", "SEG_A")).toEqual([
      "admin",
      workspaceId,
      "matching-students",
      "run-1",
      "SEG_A",
    ]);

    expect(adminQueryKeys.fairnessByRun(workspaceId, "run-1")).toEqual([
      "admin",
      workspaceId,
      "fairness",
      "run-1",
    ]);
  });

  it("produces distinct keys for different segments", () => {
    expect(
      adminQueryKeys.roomsByRunSegment(workspaceId, "run-1", "SEG_A").join("|"),
    ).not.toEqual(adminQueryKeys.roomsByRunSegment(workspaceId, "run-1", "SEG_B").join("|"));
  });
});
