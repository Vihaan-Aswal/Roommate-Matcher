import { useEffect, useMemo } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { AdminPageHeader } from "../../components/AdminPageHeader";
import { InlineAlert } from "../../components/InlineAlert";
import { FairnessBarChart } from "../../components/reports/FairnessBarChart";
import { FairnessCountsCard } from "../../components/reports/FairnessCountsCard";
import { RunSegmentSelector } from "../../components/reports/RunSegmentSelector";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { useAdminMatchingRunsQuery } from "../../hooks/useAdminMatchingRuns";
import { useRunFairnessQuery } from "../../hooks/useRunFairnessQuery";
import type { SatisfactionLabel } from "../../lib/apiClient";

function buildStudentRoute(
  runId: string,
  segment: string,
  label: "all" | SatisfactionLabel,
  atRisk: "0" | "1",
): string {
  const params = new URLSearchParams();
  params.set("segment", segment);
  params.set("label", label);
  params.set("atRisk", atRisk);
  return `/admin/matching-runs/${encodeURIComponent(runId)}/students?${params.toString()}`;
}

export function FairnessReportsPage(): JSX.Element {
  const { runId: routeRunId } = useParams<{ runId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const runsQuery = useAdminMatchingRunsQuery();
  const selectedSegment = searchParams.get("segment") ?? "all";

  const runOptions = useMemo(
    () =>
      (runsQuery.data?.runs ?? []).filter(
        (run) => run.status === "completed" || run.status === "running",
      ),
    [runsQuery.data?.runs],
  );

  const resolvedRunId = useMemo(() => {
    if (routeRunId) {
      return routeRunId;
    }

    return runOptions[0]?.run_id ?? null;
  }, [routeRunId, runOptions]);

  useEffect(() => {
    if (!resolvedRunId || routeRunId) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    if (!next.has("segment")) {
      next.set("segment", "all");
    }
    navigate(
      `/admin/fairness/${encodeURIComponent(resolvedRunId)}?${next.toString()}`,
      {
        replace: true,
      },
    );
  }, [navigate, resolvedRunId, routeRunId, searchParams]);

  const fairnessQuery = useRunFairnessQuery(resolvedRunId);

  useEffect(() => {
    if (!fairnessQuery.data) {
      return;
    }

    if (selectedSegment === "all") {
      return;
    }

    const segmentExists = fairnessQuery.data.by_segment.some(
      (segment) => segment.segment_key === selectedSegment,
    );

    if (!segmentExists) {
      const next = new URLSearchParams(searchParams);
      next.set("segment", "all");
      setSearchParams(next, { replace: true });
    }
  }, [fairnessQuery.data, searchParams, selectedSegment, setSearchParams]);

  const visibleSegments = useMemo(() => {
    if (!fairnessQuery.data) {
      return [];
    }

    if (selectedSegment === "all") {
      return fairnessQuery.data.by_segment;
    }

    return fairnessQuery.data.by_segment.filter(
      (segment) => segment.segment_key === selectedSegment,
    );
  }, [fairnessQuery.data, selectedSegment]);

  if (!resolvedRunId) {
    return (
      <section className="space-y-4">
        <InlineAlert
          title="No fairness snapshot available"
          message="Run matching to create fairness snapshots before opening reports."
          tone="info"
        />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <AdminPageHeader
        title="Reports & Fairness"
        description={`Fairness snapshot for run ${resolvedRunId}.`}
      />

      {runsQuery.isError ? (
        <InlineAlert
          title="Unable to load runs"
          message={
            runsQuery.error instanceof Error
              ? runsQuery.error.message
              : "Runs request failed."
          }
          actions={
            <button
              className="rounded-md border border-input px-3 py-2 text-sm hover:bg-muted"
              type="button"
              onClick={() => void runsQuery.refetch()}
            >
              Retry
            </button>
          }
          tone="error"
        />
      ) : null}

      {runsQuery.data ? (
        <RunSegmentSelector
          runs={runOptions}
          segmentOptions={
            fairnessQuery.data?.by_segment.map((row) => row.segment_key) ?? []
          }
          selectedRunId={resolvedRunId}
          selectedSegment={selectedSegment}
          onRunChange={(nextRunId) => {
            const next = new URLSearchParams(searchParams);
            if (!next.has("segment")) {
              next.set("segment", "all");
            }
            navigate(
              `/admin/fairness/${encodeURIComponent(nextRunId)}?${next.toString()}`,
            );
          }}
          onSegmentChange={(segment) => {
            const next = new URLSearchParams(searchParams);
            next.set("segment", segment);
            setSearchParams(next);
          }}
        />
      ) : null}

      {fairnessQuery.isLoading ? (
        <InlineAlert
          title="Loading fairness report"
          message="Preparing distribution and segment statistics."
          tone="info"
        />
      ) : null}

      {fairnessQuery.isError ? (
        <InlineAlert
          title="Unable to load fairness report"
          message={
            fairnessQuery.error instanceof Error
              ? fairnessQuery.error.message
              : "Fairness report request failed."
          }
          actions={
            <button
              className="rounded-md border border-input px-3 py-2 text-sm hover:bg-muted"
              type="button"
              onClick={() => void fairnessQuery.refetch()}
            >
              Retry
            </button>
          }
          tone="error"
        />
      ) : null}

      {fairnessQuery.data && fairnessQuery.data.by_segment.length === 0 ? (
        <InlineAlert
          title="No fairness snapshot data"
          message="This run has no segment fairness breakdown yet."
          actions={
            <Link
              className="inline-flex rounded-md border border-input px-3 py-2 text-sm hover:bg-muted"
              to="/admin/matching-runs"
            >
              Open Matching Runs
            </Link>
          }
          tone="info"
        />
      ) : null}

      {fairnessQuery.data ? (
        <>
          <Card className="border-border/80 bg-white/90">
            <CardHeader>
              <CardTitle className="text-lg">Run summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Total students: {fairnessQuery.data.total_students}
              </p>
              <button
                className="rounded-md border border-border/70 px-3 py-2 text-sm hover:bg-muted/30"
                type="button"
                onClick={() => {
                  navigate(buildStudentRoute(resolvedRunId, "all", "all", "1"));
                }}
              >
                At risk: {fairnessQuery.data.run_at_risk_count}
              </button>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-white/90">
            <CardHeader>
              <CardTitle className="text-lg">Run label distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <FairnessBarChart
                counts={fairnessQuery.data.run_label_counts}
                percentages={fairnessQuery.data.run_label_percentages}
                onLabelClick={(label) => {
                  navigate(buildStudentRoute(resolvedRunId, "all", label, "0"));
                }}
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {visibleSegments.map((segment) => (
              <FairnessCountsCard
                key={segment.segment_key}
                segment={segment}
                onSegmentAtRiskClick={(segmentKey) => {
                  navigate(
                    buildStudentRoute(resolvedRunId, segmentKey, "all", "1"),
                  );
                }}
                onSegmentLabelClick={(segmentKey, label) => {
                  navigate(
                    buildStudentRoute(resolvedRunId, segmentKey, label, "0"),
                  );
                }}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
