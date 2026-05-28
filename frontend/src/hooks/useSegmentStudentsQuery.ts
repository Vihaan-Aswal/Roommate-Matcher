import { useQuery } from "@tanstack/react-query";

import { getSegmentStudents } from "../lib/apiClient";
import { adminQueryKeys } from "./adminQueryKeys";

export function useSegmentStudentsQuery(workspaceId: string, segmentKey: string | null) {
  return useQuery({
    queryKey: adminQueryKeys.segmentStudents(workspaceId, segmentKey ?? ""),
    queryFn: () => getSegmentStudents(workspaceId, segmentKey ?? ""),
    enabled: Boolean(segmentKey),
  });
}
