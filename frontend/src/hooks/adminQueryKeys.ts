export const adminQueryKeys = {
  dashboard: ["admin", "dashboard"] as const,
  segments: ["admin", "segments"] as const,
  formStatus: ["admin", "form-status"] as const,
  nonSubmitters: ["admin", "form-non-submitters"] as const,
  matchingRuns: ["admin", "matching-runs"] as const,
  fairnessByRun: (runId: string) =>
    ["admin", "fairness", runId] as const,
  roomsByRunSegment: (runId: string, segmentKey: string) =>
    ["admin", "matching-rooms", runId, segmentKey] as const,
  studentsByRunSegment: (runId: string, segmentKey: string) =>
    ["admin", "matching-students", runId, segmentKey] as const,
  segmentStudents: (segmentKey: string) =>
    ["admin", "segment-students", segmentKey] as const,
  checkerCompatibility: (segmentKey: string, studentIds: string[]) =>
    ["admin", "checker", segmentKey, ...studentIds] as const,
};
