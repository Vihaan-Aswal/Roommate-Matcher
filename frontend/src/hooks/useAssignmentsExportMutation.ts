import { useMutation } from "@tanstack/react-query";

import { exportAssignmentsCsv } from "../lib/apiClient";

export interface ExportAssignmentsInput {
  runId: string;
  segmentKey?: string;
}

export function useAssignmentsExportMutation(workspaceId: string) {
  return useMutation({
    mutationFn: ({ runId, segmentKey }: ExportAssignmentsInput) =>
      exportAssignmentsCsv(workspaceId, runId, segmentKey),
  });
}
