import { useMutation } from "@tanstack/react-query";

import {
  type CheckerRequestPayload,
  runCheckerCompatibility,
} from "../lib/apiClient";

export function useManualCheckerMutation(workspaceId: string) {
  return useMutation({
    mutationFn: (payload: CheckerRequestPayload) =>
      runCheckerCompatibility(payload),
  });
}
