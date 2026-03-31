import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import type { RunStudentRow } from "../lib/apiClient";
import { getRunStudents } from "../lib/apiClient";
import { adminQueryKeys } from "./adminQueryKeys";

interface UseRunStudentsAcrossSegmentsResult {
  students: RunStudentRow[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetchAll: () => Promise<unknown[]>;
}

export function useRunStudentsAcrossSegmentsQuery(
  runId: string,
  segmentKeys: string[],
  enabled: boolean,
): UseRunStudentsAcrossSegmentsResult {
  const segmentQueries = useQueries({
    queries: segmentKeys.map((segmentKey) => ({
      queryKey: adminQueryKeys.studentsByRunSegment(runId, segmentKey),
      queryFn: () => getRunStudents(runId, segmentKey),
      enabled: enabled && Boolean(runId),
    })),
  });

  const students = useMemo(() => {
    const merged: RunStudentRow[] = [];

    for (const query of segmentQueries) {
      if (query.data?.students) {
        merged.push(...query.data.students);
      }
    }

    return merged.sort((left, right) =>
      left.admission_number.localeCompare(right.admission_number),
    );
  }, [segmentQueries]);

  const firstError =
    segmentQueries.find((query) => query.error)?.error ?? null;

  return {
    students,
    isLoading: segmentQueries.some((query) => query.isLoading),
    isError: segmentQueries.some((query) => query.isError),
    error: firstError instanceof Error ? firstError : null,
    refetchAll: () => Promise.all(segmentQueries.map((query) => query.refetch())),
  };
}
