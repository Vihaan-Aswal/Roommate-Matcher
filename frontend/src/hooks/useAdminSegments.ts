import { useQuery } from "@tanstack/react-query";

import { getSegments } from "../lib/apiClient";
import { adminQueryKeys } from "./adminQueryKeys";

export function useAdminSegmentsQuery(workspaceId: string | null) {
  return useQuery({
    queryKey: workspaceId ? adminQueryKeys.segments(workspaceId) : ["workspace", "none", "segments"],
    queryFn: () => getSegments(workspaceId!),
    enabled: !!workspaceId,
  });
}
