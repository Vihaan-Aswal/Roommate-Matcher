import { useQuery } from "@tanstack/react-query";

import { getRunStudents } from "../lib/apiClient";
import { adminQueryKeys } from "./adminQueryKeys";

export function useRunStudentsQuery(workspaceId: string, runId: string, segmentKey: string | null) {
  return useQuery({
    queryKey: adminQueryKeys.studentsByRunSegment(workspaceId, runId, segmentKey ?? ""),
    queryFn: () => getRunStudents(workspaceId, runId, segmentKey ?? ""),
    enabled: Boolean(runId && segmentKey),
  });
}
