import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type StudentImportDiffResponse,
  type StudentImportApplyResponse,
  type RoomImportDiffResponse,
  type RoomImportApplyResponse,
  type UploadSummaryResponse,
  previewStudentUpload,
  applyStudentUpload,
  previewRoomUpload,
  applyRoomUpload,
  uploadStudentsCsv,
  uploadRoomsCsv,
} from "../lib/apiClient";
import { adminQueryKeys } from "./adminQueryKeys";

async function invalidateUploadDependents(
  invalidate: (queryKey: readonly string[]) => Promise<void>,
  workspaceId: string,
): Promise<void> {
  await Promise.all([
    invalidate(adminQueryKeys.workspaceDashboard(workspaceId)),
    invalidate(adminQueryKeys.segments),
    invalidate(adminQueryKeys.formStatus),
    invalidate(adminQueryKeys.nonSubmitters),
  ]);
}

// -- Student mutations --

export function usePreviewStudentUploadMutation(workspaceId: string) {
  return useMutation<StudentImportDiffResponse, Error, File>({
    mutationFn: (file) => previewStudentUpload(workspaceId, file),
  });
}

export function useApplyStudentUploadMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation<StudentImportApplyResponse, Error, File>({
    mutationFn: (file) => applyStudentUpload(workspaceId, file),
    onSuccess: async () => {
      await invalidateUploadDependents(
        (queryKey) => queryClient.invalidateQueries({ queryKey }),
        workspaceId,
      );
    },
  });
}

// -- Room mutations --

export function usePreviewRoomUploadMutation(workspaceId: string) {
  return useMutation<RoomImportDiffResponse, Error, File>({
    mutationFn: (file) => previewRoomUpload(workspaceId, file),
  });
}

export function useApplyRoomUploadMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation<RoomImportApplyResponse, Error, File>({
    mutationFn: (file) => applyRoomUpload(workspaceId, file),
    onSuccess: async () => {
      await invalidateUploadDependents(
        (queryKey) => queryClient.invalidateQueries({ queryKey }),
        workspaceId,
      );
    },
  });
}

// DEPRECATED: Keep legacy hooks for backward compat until all references are removed.
export function useUploadStudentsMutation() {
  const queryClient = useQueryClient();

  return useMutation<UploadSummaryResponse, Error, File>({
    mutationFn: (file) => uploadStudentsCsv(file),
    onSuccess: async () => {
      // Legacy hooks might use old dashboard key, we just invalidate commonly used keys to be safe
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.segments }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.formStatus }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.nonSubmitters }),
      ]);
    },
  });
}

export function useUploadRoomsMutation() {
  const queryClient = useQueryClient();

  return useMutation<UploadSummaryResponse, Error, File>({
    mutationFn: (file) => uploadRoomsCsv(file),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.segments }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.formStatus }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.nonSubmitters }),
      ]);
    },
  });
}
