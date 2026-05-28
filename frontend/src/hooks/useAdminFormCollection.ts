import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { getFormStatus, getNonSubmitters, getWorkspaceFormLink, regenerateWorkspaceFormLink, type FormLinkResponse } from "../lib/apiClient";
import { adminQueryKeys } from "./adminQueryKeys";

export function useAdminFormStatusQuery(workspaceId: string | null) {
  return useQuery({
    queryKey: [...adminQueryKeys.formStatus, workspaceId],
    queryFn: () => getFormStatus(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useAdminNonSubmittersQuery(workspaceId: string | null) {
  return useQuery({
    queryKey: [...adminQueryKeys.nonSubmitters, workspaceId],
    queryFn: () => getNonSubmitters(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useWorkspaceFormLinkQuery(workspaceId: string | null) {
  return useQuery({
    queryKey: ["workspace", workspaceId, "form-link"],
    queryFn: () => getWorkspaceFormLink(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useRegenerateFormLinkMutation(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<FormLinkResponse, Error>({
    mutationFn: () => regenerateWorkspaceFormLink(workspaceId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId, "form-link"] });
    },
  });
}
