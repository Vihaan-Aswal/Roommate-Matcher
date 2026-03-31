import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type MatchingRunRequest,
  getMatchingRuns,
  runMatching,
} from "../lib/apiClient";
import { adminQueryKeys } from "./adminQueryKeys";

export function useAdminMatchingRunsQuery() {
  return useQuery({
    queryKey: adminQueryKeys.matchingRuns,
    queryFn: getMatchingRuns,
  });
}

export function useRunMatchingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MatchingRunRequest) => runMatching(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminQueryKeys.matchingRuns,
        }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.segments }),
      ]);
    },
  });
}
