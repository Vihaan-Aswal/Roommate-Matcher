export const adminQueryKeys = {
  workspaces: ["workspaces"] as const,
  workspaceDashboard: (workspaceId: string) => ["workspace", workspaceId, "dashboard"] as const,
  workspaceDetail: (workspaceId: string) => ["workspace", workspaceId] as const,
  dashboard: (workspaceId: string) => ["workspace", workspaceId, "dashboard-legacy"] as const,
  segments: (workspaceId: string) => ["workspace", workspaceId, "segments"] as const,
  formStatus: (workspaceId: string) => ["workspace", workspaceId, "form-status"] as const,
  nonSubmitters: (workspaceId: string) => ["workspace", workspaceId, "form-non-submitters"] as const,
  matchingRuns: (workspaceId: string) => ["workspace", workspaceId, "matching-runs"] as const,
  fairnessByRun: (workspaceId: string, runId: string) => ["workspace", workspaceId, "fairness", runId] as const,
  roomsByRunSegment: (workspaceId: string, runId: string, segmentKey: string) =>
    ["workspace", workspaceId, "matching-rooms", runId, segmentKey] as const,
  studentsByRunSegment: (workspaceId: string, runId: string, segmentKey: string) =>
    ["workspace", workspaceId, "matching-students", runId, segmentKey] as const,
  segmentStudents: (workspaceId: string, segmentKey: string) =>
    ["workspace", workspaceId, "segment-students", segmentKey] as const,
  checkerCompatibility: (workspaceId: string, segmentKey: string, studentIds: string[]) =>
    ["workspace", workspaceId, "checker", segmentKey, ...studentIds] as const,
  runStudentsAllSegments: (workspaceId: string, runId: string) =>
    ["workspace", workspaceId, "matching-students-all", runId] as const,
};
