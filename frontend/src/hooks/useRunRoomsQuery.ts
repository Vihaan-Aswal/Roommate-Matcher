import { useQuery } from "@tanstack/react-query";

import { getRunRooms } from "../lib/apiClient";
import { adminQueryKeys } from "./adminQueryKeys";

export function useRunRoomsQuery(workspaceId: string, runId: string, segmentKey: string | null) {
  return useQuery({
    queryKey: adminQueryKeys.roomsByRunSegment(workspaceId, runId, segmentKey ?? ""),
    queryFn: () => getRunRooms(workspaceId, runId, segmentKey ?? ""),
    enabled: Boolean(runId && segmentKey),
  });
}
