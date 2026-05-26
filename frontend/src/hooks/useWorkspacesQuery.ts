import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  WorkspaceCreateRequest,
  WorkspaceDashboardResponse,
  WorkspaceListResponse,
  WorkspaceResponse,
  createWorkspace,
  getWorkspaceDashboard,
  getWorkspaces,
} from "../lib/apiClient";
import { adminQueryKeys } from "./adminQueryKeys";

export function useWorkspacesQuery() {
  return useQuery<WorkspaceListResponse, Error>({
    queryKey: adminQueryKeys.workspaces,
    queryFn: getWorkspaces,
  });
}

export function useWorkspaceDashboardQuery(workspaceId: string) {
  return useQuery<WorkspaceDashboardResponse, Error>({
    queryKey: adminQueryKeys.workspaceDashboard(workspaceId),
    queryFn: () => getWorkspaceDashboard(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useCreateWorkspaceMutation() {
  const queryClient = useQueryClient();

  return useMutation<WorkspaceResponse, Error, WorkspaceCreateRequest>({
    mutationFn: (body: WorkspaceCreateRequest) => createWorkspace(body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: adminQueryKeys.workspaces,
      });
    },
  });
}
