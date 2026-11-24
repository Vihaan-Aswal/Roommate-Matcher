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
    refetchInterval: (query) =>
      query.state.data?.runs.some(
        (run) => run.status === "running" || run.status === "pending",
      )
        ? 2500
        : false,
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
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.dashboard(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.segments(workspaceId) }),
      ]);
    },
  });
}
