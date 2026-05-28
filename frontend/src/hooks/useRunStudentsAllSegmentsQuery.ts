import { useQuery } from "@tanstack/react-query";

import { adminQueryKeys } from "./adminQueryKeys";
import { getRunStudentsAllSegments } from "../lib/apiClient";
import type { RunStudentRow } from "../lib/apiClient";

export function useRunStudentsAllSegmentsQuery(
  workspaceId: string,
  runId: string,
  enabled: boolean,
) {
  const query = useQuery({
    queryKey: adminQueryKeys.runStudentsAllSegments(workspaceId, runId),
    queryFn: () => getRunStudentsAllSegments(workspaceId, runId),
    enabled: enabled && Boolean(runId) && Boolean(workspaceId),
  });

  const students = (query.data?.segments ?? []).flatMap(segment => segment.students)
    .sort((left, right) => left.admission_number.localeCompare(right.admission_number));

  return {
    students,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error instanceof Error ? query.error : null,
    refetchAll: () => query.refetch(),
  };
}
