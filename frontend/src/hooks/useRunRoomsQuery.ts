import { useQuery } from "@tanstack/react-query";

import { getRunRooms } from "../lib/apiClient";
import { adminQueryKeys } from "./adminQueryKeys";

export function useRunRoomsQuery(runId: string, segmentKey: string | null) {
  return useQuery({
    queryKey: adminQueryKeys.roomsByRunSegment(runId, segmentKey ?? ""),
    queryFn: () => getRunRooms(runId, segmentKey ?? ""),
    enabled: Boolean(runId && segmentKey),
  });
}
