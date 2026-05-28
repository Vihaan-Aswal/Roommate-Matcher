import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type MatchingRunRequest,
  getMatchingRuns,
  runMatching,
} from "../lib/apiClient";
import { adminQueryKeys } from "./adminQueryKeys";

export function useAdminMatchingRunsQuery(workspaceId: string) {
  return useQuery({
    queryKey: adminQueryKeys.matchingRuns(workspaceId),
    queryFn: () => getMatchingRuns(workspaceId),
  });
}

export function useRunMatchingMutation(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MatchingRunRequest) => runMatching(workspaceId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminQueryKeys.matchingRuns(workspaceId),
        }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.segments }),
      ]);
    },
  });
}
