import { useQuery } from "@tanstack/react-query";

import { getDashboardSummary } from "../lib/apiClient";
import { adminQueryKeys } from "./adminQueryKeys";

export function useAdminDashboardQuery() {
  return useQuery({
    queryKey: adminQueryKeys.dashboard("legacy"),
    queryFn: getDashboardSummary,
  });
}
