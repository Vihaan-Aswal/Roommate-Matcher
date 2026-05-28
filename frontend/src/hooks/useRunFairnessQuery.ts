import { useQuery } from "@tanstack/react-query";

import { getFairnessReport } from "../lib/apiClient";
import { adminQueryKeys } from "./adminQueryKeys";

export function useRunFairnessQuery(workspaceId: string, runId: string | null) {
  return useQuery({
    queryKey: adminQueryKeys.fairnessByRun(workspaceId, runId ?? ""),
    queryFn: () => getFairnessReport(workspaceId, runId ?? ""),
    enabled: Boolean(runId),
  });
}
