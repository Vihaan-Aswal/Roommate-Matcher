import { useQuery } from "@tanstack/react-query";

import { getSegmentStudents } from "../lib/apiClient";
import { adminQueryKeys } from "./adminQueryKeys";

export function useSegmentStudentsQuery(segmentKey: string | null) {
  return useQuery({
    queryKey: adminQueryKeys.segmentStudents(segmentKey ?? ""),
    queryFn: () => getSegmentStudents(segmentKey ?? ""),
    enabled: Boolean(segmentKey),
  });
}
