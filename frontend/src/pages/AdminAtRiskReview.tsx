import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { InlineAlert } from "../components/InlineAlert";
import { useAdminMatchingRunsQuery } from "../hooks/useAdminMatchingRuns";
import { useWorkspace } from "../providers/WorkspaceProvider";

export function AdminAtRiskReview(): JSX.Element {
  const { workspaceId } = useWorkspace();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const runsQuery = useAdminMatchingRunsQuery(workspaceId!);

  const runFromQuery = searchParams.get("run");
  const segment = searchParams.get("segment") ?? "all";

  const fallbackRunId = useMemo(
    () =>
      runsQuery.data?.runs.find((run) => run.status === "completed")?.run_id ??
      null,
    [runsQuery.data?.runs],
  );

  const resolvedRunId = runFromQuery ?? fallbackRunId;

  useEffect(() => {
    if (!resolvedRunId) {
      return;
    }

    const params = new URLSearchParams();
    params.set("segment", segment);
    params.set("label", "all");
    params.set("atRisk", "1");

    navigate(
      `/admin/matching-runs/${encodeURIComponent(resolvedRunId)}/students?${params.toString()}`,
      { replace: true },
    );
  }, [navigate, resolvedRunId, segment]);

  if (!resolvedRunId) {
    return (
      <InlineAlert
        title="No run available"
        message="Run matching at least once before using At-Risk Review."
        tone="info"
      />
    );
  }

  return (
    <InlineAlert
      title="Redirecting to At-Risk students"
      message="Applying at-risk filter in student results."
      tone="info"
    />
  );
}
