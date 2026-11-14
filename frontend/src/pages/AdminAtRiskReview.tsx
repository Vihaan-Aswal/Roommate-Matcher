import { useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { AdminPageHeader } from "../components/AdminPageHeader";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/ui/button";
import { useAdminMatchingRunsQuery } from "../hooks/useAdminMatchingRuns";
import { useWorkspace } from "../providers/WorkspaceProvider";

/**
 * At-Risk Review has no page of its own: it resolves the newest completed run
 * and opens the student register with the at-risk filter applied.
 */
export function AdminAtRiskReview(): JSX.Element {
  const { workspaceId, workspaceName } = useWorkspace();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const runsQuery = useAdminMatchingRunsQuery(workspaceId!);

  const runFromQuery = searchParams.get("run");
  const segment = searchParams.get("segment") ?? "all";

  const fallbackRunId = useMemo(
    () => runsQuery.data?.runs.find((run) => run.status === "completed")?.run_id ?? null,
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
      `/app/${workspaceId}/matching-runs/${encodeURIComponent(resolvedRunId)}/students?${params.toString()}`,
      { replace: true },
    );
  }, [navigate, resolvedRunId, segment, workspaceId]);

  if (!resolvedRunId) {
    return (
      <section className="desk-stack">
        <AdminPageHeader
          title="At-Risk Review"
          workspace={workspaceName ?? undefined}
          description="The at-risk list is read from a completed run's student results."
        />
        <EmptyState
          title="No completed run yet"
          line="Run matching at least once. The review then opens the students who scored below the floor."
          action={
            <Button asChild size="sm">
              <Link to={`/app/${workspaceId}/matching-runs`}>Open matching runs</Link>
            </Button>
          }
        />
      </section>
    );
  }

  return (
    <section className="desk-stack">
      <AdminPageHeader
        title="At-Risk Review"
        workspace={workspaceName ?? undefined}
        meta={<span className="desk-mono">{resolvedRunId}</span>}
        description="Opening the students who scored below the floor."
      />
      <p className="desk-loading-note">Applying the at-risk filter</p>
    </section>
  );
}
