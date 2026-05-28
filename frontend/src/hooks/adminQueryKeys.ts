export const adminQueryKeys = {
  workspaces: ["workspaces"] as const,
  workspaceDashboard: (workspaceId: string) => ["workspace", workspaceId, "dashboard"] as const,
  workspaceDetail: (workspaceId: string) => ["workspace", workspaceId] as const,
  dashboard: ["admin", "dashboard"] as const,
  segments: ["admin", "segments"] as const,
  formStatus: ["admin", "form-status"] as const,
  nonSubmitters: ["admin", "form-non-submitters"] as const,
  matchingRuns: (workspaceId: string) => ["admin", workspaceId, "matching-runs"] as const,
  fairnessByRun: (workspaceId: string, runId: string) => ["admin", workspaceId, "fairness", runId] as const,
  roomsByRunSegment: (workspaceId: string, runId: string, segmentKey: string) =>
    ["admin", workspaceId, "matching-rooms", runId, segmentKey] as const,
  studentsByRunSegment: (workspaceId: string, runId: string, segmentKey: string) =>
    ["admin", workspaceId, "matching-students", runId, segmentKey] as const,
  segmentStudents: (workspaceId: string, segmentKey: string) =>
    ["admin", workspaceId, "segment-students", segmentKey] as const,
  checkerCompatibility: (workspaceId: string, segmentKey: string, studentIds: string[]) =>
    ["admin", workspaceId, "checker", segmentKey, ...studentIds] as const,
};
