import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { AdminPageHeader } from "../../components/AdminPageHeader";
import DataWarningBanner from "../../components/DataWarningBanner";
import { InlineAlert } from "../../components/InlineAlert";
import { EmptyState } from "../../components/EmptyState";
import { FairnessBarChart } from "../../components/reports/FairnessBarChart";
import { FairnessCountsCard } from "../../components/reports/FairnessCountsCard";
import { RunSegmentSelector } from "../../components/reports/RunSegmentSelector";
import { Button } from "../../components/ui/button";
import { useAdminMatchingRunsQuery } from "../../hooks/useAdminMatchingRuns";
import { useRunFairnessQuery } from "../../hooks/useRunFairnessQuery";
import type { SatisfactionLabel } from "../../lib/apiClient";
import { segmentLabel } from "../../lib/segmentLabel";
import { useWorkspace } from "../../providers/WorkspaceProvider";

function buildStudentRoute(
  workspaceId: string,
  runId: string,
  segment: string,
  label: "all" | SatisfactionLabel,
  atRisk: "0" | "1",
): string {
  const params = new URLSearchParams();
  params.set("segment", segment);
  params.set("label", label);
  params.set("atRisk", atRisk);
  return `/app/${encodeURIComponent(workspaceId)}/matching-runs/${encodeURIComponent(runId)}/students?${params.toString()}`;
}

export function FairnessReportsPage(): JSX.Element {
  const { workspaceId, runId: routeRunId } = useParams<{ workspaceId: string; runId?: string }>();
  if (!workspaceId) throw new Error("workspaceId is required");
  const { workspaceName } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const runsQuery = useAdminMatchingRunsQuery(workspaceId);
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
      `/app/${encodeURIComponent(workspaceId)}/fairness/${encodeURIComponent(resolvedRunId)}?${next.toString()}`,
      { replace: true },
    );
  }, [navigate, resolvedRunId, routeRunId, searchParams, workspaceId]);

  const fairnessQuery = useRunFairnessQuery(workspaceId, resolvedRunId);

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
      <section className="desk-stack">
        <AdminPageHeader
          title="Reports & Fairness"
          workspace={workspaceName ?? undefined}
          description="Fairness is reported as the floor: who scored lowest, and how many fell below it."
        />
        <EmptyState
          title="No fairness snapshot available"
          line="A snapshot is written when a run completes. Run matching first, then come back to read the floor."
          action={
            <Button asChild size="sm">
              <Link to={`/app/${workspaceId}/matching-runs`}>Open matching runs</Link>
            </Button>
          }
        />
      </section>
    );
  }

  const totalStudents = fairnessQuery.data?.total_students ?? 0;
  const atRiskCount = fairnessQuery.data?.run_at_risk_count ?? 0;
  const minimumSatisfaction = fairnessQuery.data?.by_segment.length
    ? Math.min(...fairnessQuery.data.by_segment.map((segment) => segment.minimum_satisfaction))
    : null;

  return (
    <section className="desk-stack">
      <AdminPageHeader
        title="Reports & Fairness"
        workspace={workspaceName ?? undefined}
        meta={
          <>
            <span className="desk-mono">{resolvedRunId}</span>
            <span className="desk-sep">·</span>
            {selectedSegment === "all"
              ? "all segments"
              : segmentLabel({ segment_key: selectedSegment })}
          </>
        }
        description="A room list can look fine and still leave one student below the floor. This page reports the floor, not the average."
      />

      {runsQuery.isError ? (
        <InlineAlert
          title="Runs could not be read"
          message={runsQuery.error instanceof Error ? runsQuery.error.message : "Runs request failed."}
          tone="error"
          actions={
            <Button size="sm" variant="outline" onClick={() => void runsQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : null}

      {runsQuery.data ? (
        <RunSegmentSelector
          runs={runOptions}
          segmentOptions={fairnessQuery.data?.by_segment.map((row) => row.segment_key) ?? []}
          selectedRunId={resolvedRunId}
          selectedSegment={selectedSegment}
          onRunChange={(nextRunId) => {
            const next = new URLSearchParams(searchParams);
            if (!next.has("segment")) {
              next.set("segment", "all");
            }
            navigate(
              `/app/${encodeURIComponent(workspaceId)}/fairness/${encodeURIComponent(nextRunId)}?${next.toString()}`,
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
        <div className="desk-stack-sm" aria-busy="true">
          <p className="desk-loading-note">Computing the floor</p>
          <div className="desk-skel" style={{ height: 84 }} />
          <div className="desk-skel" style={{ height: 160 }} />
        </div>
      ) : null}

      {fairnessQuery.isError ? (
        <InlineAlert
          title="The fairness report could not be read"
          message={
            fairnessQuery.error instanceof Error
              ? fairnessQuery.error.message
              : "Fairness report request failed."
          }
          tone="error"
          actions={
            <Button size="sm" variant="outline" onClick={() => void fairnessQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : null}

      {fairnessQuery.data && fairnessQuery.data.by_segment.length === 0 ? (
        <EmptyState
          title="This run has no fairness breakdown yet"
          line="A run writes fairness per segment. If the run is still in progress, the snapshot appears when it finishes."
          action={
            <Button asChild size="sm" variant="outline">
              <Link to={`/app/${encodeURIComponent(workspaceId)}/matching-runs`}>Open matching runs</Link>
            </Button>
          }
        />
      ) : null}

      {fairnessQuery.data && fairnessQuery.data.by_segment.length > 0 ? (
        <>
          {fairnessQuery.data.has_generated_profiles ? (
            <DataWarningBanner hasGeneratedProfiles={true} context="fairness" />
          ) : null}

          <div className="desk-directive">
            <div>
              <p className="desk-directive-line">
                {atRiskCount === 0
                  ? `Every one of the ${totalStudents} students scored at or above the floor of 0.55.`
                  : `${atRiskCount} of ${totalStudents} students scored below the floor of 0.55. Read them before keys are issued.`}
              </p>
              <p className="desk-help" style={{ marginTop: 4 }}>
                Labels: Excellent ≥ 0.90 with every heavy factor met, Good ≥ 0.70, Okay ≥ 0.55, Poor
                below 0.55.
              </p>
            </div>
            <Button
              size="sm"
              variant={atRiskCount > 0 ? "default" : "outline"}
              onClick={() => navigate(buildStudentRoute(workspaceId, resolvedRunId, selectedSegment, "all", "1"))}
            >
              {atRiskCount > 0 ? "Read the at-risk list" : "Open the at-risk view"}
            </Button>
          </div>

          <div className="desk-figures">
            <div className="desk-figure">
              <p className="desk-figure-label">Students in this run</p>
              <p className="desk-figure-value">{totalStudents}</p>
            </div>
            <div className="desk-figure">
              <p className="desk-figure-label">Below the floor</p>
              <p className="desk-figure-value" style={{ color: atRiskCount > 0 ? "var(--wax)" : undefined }}>
                {atRiskCount}
              </p>
            </div>
            <div className="desk-figure">
              <p className="desk-figure-label">Lowest score</p>
              <p className="desk-figure-value">
                {minimumSatisfaction === null ? "—" : `${(minimumSatisfaction * 100).toFixed(1)}%`}
              </p>
            </div>
            <div className="desk-figure">
              <p className="desk-figure-label">Segments</p>
              <p className="desk-figure-value">{fairnessQuery.data.by_segment.length}</p>
            </div>
          </div>

          <section className="desk-stack-sm" aria-labelledby="distribution-heading">
            <div className="desk-section-head">
              <h2 className="desk-section-title" id="distribution-heading">
                Run label distribution
              </h2>
              <p className="desk-section-note">Click a row to open those students</p>
            </div>
            <FairnessBarChart
              counts={fairnessQuery.data.run_label_counts}
              percentages={fairnessQuery.data.run_label_percentages}
              onLabelClick={(label) => {
                navigate(buildStudentRoute(workspaceId, resolvedRunId, "all", label, "0"));
              }}
            />
          </section>

          <section className="desk-stack-sm" aria-labelledby="segment-floor-heading">
            <div className="desk-section-head">
              <h2 className="desk-section-title" id="segment-floor-heading">
                The floor, segment by segment
              </h2>
              <p className="desk-section-note">
                {visibleSegments.length} segment{visibleSegments.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="desk-cols">
              {visibleSegments.map((segment) => (
                <FairnessCountsCard
                  key={segment.segment_key}
                  segment={segment}
                  onSegmentAtRiskClick={(segmentKey) => {
                    navigate(buildStudentRoute(workspaceId, resolvedRunId, segmentKey, "all", "1"));
                  }}
                  onSegmentLabelClick={(segmentKey, label) => {
                    navigate(buildStudentRoute(workspaceId, resolvedRunId, segmentKey, label, "0"));
                  }}
                />
              ))}
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
