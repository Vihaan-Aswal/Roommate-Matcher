import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type StudentImportDiffResponse,
  type StudentImportApplyResponse,
  type RoomImportDiffResponse,
  type RoomImportApplyResponse,
  previewStudentUpload,
  applyStudentUpload,
  previewRoomUpload,
  applyRoomUpload,
} from "../lib/apiClient";
import { adminQueryKeys } from "./adminQueryKeys";

async function invalidateUploadDependents(
  invalidate: (queryKey: readonly string[]) => Promise<void>,
  workspaceId: string,
): Promise<void> {
  await Promise.all([
    invalidate(adminQueryKeys.workspaceDashboard(workspaceId)),
    invalidate(adminQueryKeys.segments(workspaceId)),
    invalidate(adminQueryKeys.formStatus(workspaceId)),
    invalidate(adminQueryKeys.nonSubmitters(workspaceId)),
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

