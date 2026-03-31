import { useQuery } from "@tanstack/react-query";

import { getFairnessReport } from "../lib/apiClient";
import { adminQueryKeys } from "./adminQueryKeys";

export function useRunFairnessQuery(runId: string | null) {
  return useQuery({
    queryKey: adminQueryKeys.fairnessByRun(runId ?? ""),
    queryFn: () => getFairnessReport(runId ?? ""),
    enabled: Boolean(runId),
  });
}
