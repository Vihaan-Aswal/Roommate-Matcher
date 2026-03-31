import { useQuery } from "@tanstack/react-query";

import { getRunStudents } from "../lib/apiClient";
import { adminQueryKeys } from "./adminQueryKeys";

export function useRunStudentsQuery(runId: string, segmentKey: string | null) {
  return useQuery({
    queryKey: adminQueryKeys.studentsByRunSegment(runId, segmentKey ?? ""),
    queryFn: () => getRunStudents(runId, segmentKey ?? ""),
    enabled: Boolean(runId && segmentKey),
  });
}
