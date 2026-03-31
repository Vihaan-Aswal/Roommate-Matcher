import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  type UploadSummaryResponse,
  uploadRoomsCsv,
  uploadStudentsCsv,
} from "../lib/apiClient";
import { adminQueryKeys } from "./adminQueryKeys";

async function invalidateUploadDependents(
  invalidate: (queryKey: readonly string[]) => Promise<void>,
): Promise<void> {
  await Promise.all([
    invalidate(adminQueryKeys.dashboard),
    invalidate(adminQueryKeys.segments),
    invalidate(adminQueryKeys.formStatus),
    invalidate(adminQueryKeys.nonSubmitters),
  ]);
}

export function useUploadStudentsMutation() {
  const queryClient = useQueryClient();

  return useMutation<UploadSummaryResponse, Error, File>({
    mutationFn: (file) => uploadStudentsCsv(file),
    onSuccess: async () => {
      await invalidateUploadDependents((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      );
    },
  });
}

export function useUploadRoomsMutation() {
  const queryClient = useQueryClient();

  return useMutation<UploadSummaryResponse, Error, File>({
    mutationFn: (file) => uploadRoomsCsv(file),
    onSuccess: async () => {
      await invalidateUploadDependents((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      );
    },
  });
}
