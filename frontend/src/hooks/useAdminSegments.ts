import { useQuery } from "@tanstack/react-query";

import { getSegments } from "../lib/apiClient";
import { adminQueryKeys } from "./adminQueryKeys";

export function useAdminSegmentsQuery() {
  return useQuery({
    queryKey: adminQueryKeys.segments,
    queryFn: getSegments,
  });
}
