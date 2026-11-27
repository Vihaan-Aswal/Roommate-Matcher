import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Sparkles } from "lucide-react";

import { magicFillWorkspace } from "../lib/apiClient";
import type { MatchingRunHistoryRow, SegmentOverview } from "../lib/apiClient";
import { segmentLabel } from "../lib/segmentLabel";

import { AdminPageHeader } from "../components/AdminPageHeader";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { InlineAlert } from "../components/InlineAlert";
import { EmptyState } from "../components/EmptyState";
import { SegmentLabel } from "../components/SegmentLabel";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../hooks/use-toast";
import {
  useAdminMatchingRunsQuery,
  useRunMatchingMutation,
} from "../hooks/useAdminMatchingRuns";
import { useAdminSegmentsQuery } from "../hooks/useAdminSegments";
import { useWorkspace } from "../providers/WorkspaceProvider";
import { Button } from "../components/ui/button";

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }
  return parsed.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function AdminMatchingRuns(): JSX.Element {
  const { workspaceId, workspaceName } = useWorkspace();

  const segmentsQuery = useAdminSegmentsQuery(workspaceId!);
  const runsQuery = useAdminMatchingRunsQuery(workspaceId!);
  const runMutation = useRunMatchingMutation(workspaceId!);
  const { toast } = useToast();

  const [magicFillLoading, setMagicFillLoading] = useState<string | null>(null);

  async function handleSegmentMagicFill(segment: SegmentOverview) {
    if (!workspaceId) return;
    setMagicFillLoading(segment.segment_key);
    try {
      const result = await magicFillWorkspace(workspaceId, segment.segment_key);
      toast({
        title: "Magic Fill complete",
        description: `${segmentLabel(segment)}: ${result.profiles_created} generated profiles.`,
      });
      segmentsQuery.refetch();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Magic Fill failed",
        description: err instanceof Error ? err.message : "Magic Fill failed.",
      });
    } finally {
      setMagicFillLoading(null);
    }
  }

  const segments = useMemo(
    () => segmentsQuery.data?.segments ?? [],
    [segmentsQuery.data?.segments],
  );
  const runs = runsQuery.data?.runs ?? [];
  const hasRunningRun = runs.some(
    (run) => run.status === "running" || run.status === "pending",
  );

  const readySegments = useMemo(
    () => segments.filter((segment) => segment.status === "Ready"),
    [segments],
  );

  const defaultSegmentKey = segments[0]?.segment_key ?? null;

  const segmentColumns: DataTableColumn<SegmentOverview>[] = [
    {
      key: "segment_key",
      header: "Segment",
      cell: (row) => <SegmentLabel segment={row} showKey />,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge value={row.status} />,
    },
    {
      key: "students",
      header: "Students",
      align: "right",
      cell: (row) => <span className="desk-num">{row.student_count}</span>,
    },
    {
      key: "capacity",
      header: "Beds",
      align: "right",
      cell: (row) => (
        <span
          className="desk-num"
          style={{ color: row.total_capacity < row.student_count ? "var(--wax)" : undefined }}
        >
          {row.total_capacity}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Action",
      cell: (row) => (
        <div className="desk-row" style={{ gap: 6 }}>
          <Button
            disabled={runMutation.isPending || hasRunningRun || row.status !== "Ready"}
            size="sm"
            variant="outline"
            onClick={() => {
              void runMutation.mutateAsync({
                scope: "segment",
                segment_key: row.segment_key,
              });
            }}
          >
            Run segment
          </Button>
          <Button
            onClick={() => void handleSegmentMagicFill(row)}
            disabled={magicFillLoading === row.segment_key || row.status === "Ready"}
            size="sm"
            variant="ghost"
            title="Write generated preference profiles for this segment"
          >
            <Sparkles size={12} strokeWidth={1.8} aria-hidden="true" />
            {magicFillLoading === row.segment_key ? "Filling…" : "Fill missing"}
          </Button>
        </div>
      ),
    },
  ];

  const runColumns: DataTableColumn<MatchingRunHistoryRow>[] = [
    {
      key: "run_id",
      header: "Run",
      cell: (row) => (
        <div>
          <p className="desk-mono">{row.run_id}</p>
          <p className="desk-list-meta" style={{ marginTop: 2 }}>
            {row.scope === "all_ready_segments" ? "All ready segments" : "Single segment"}
            <span className="desk-sep"> · </span>
            {row.segments_completed} completed
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge value={row.status} />,
    },
    {
      key: "created_at",
      header: "Created",
      cell: (row) => <span className="desk-num">{formatDateTime(row.created_at)}</span>,
    },
    {
      key: "actions",
      header: "Open",
      cell: (row) => {
        const canOpen = row.status === "completed";
        if (!canOpen) {
          return (
            <span className="desk-help">
              {row.status === "running" || row.status === "pending" ? "Running" : "Not ready"}
            </span>
          );
        }
        const roomRoute = defaultSegmentKey
          ? `/app/${workspaceId}/matching-runs/${encodeURIComponent(row.run_id)}/rooms?segment=${encodeURIComponent(defaultSegmentKey)}&needsReview=0`
          : `/app/${workspaceId}/matching-runs`;
        return (
          <div className="desk-row" style={{ gap: 12 }}>
            <Link className="desk-link" style={{ fontSize: 13 }} to={roomRoute}>
              Rooms
            </Link>
            <Link
              className="desk-link"
              style={{ fontSize: 13 }}
              to={`/app/${workspaceId}/matching-runs/${encodeURIComponent(row.run_id)}/students?segment=all&label=all&atRisk=0`}
            >
              Students
            </Link>
            <Link
              className="desk-link"
              style={{ fontSize: 13 }}
              to={`/app/${workspaceId}/fairness/${encodeURIComponent(row.run_id)}?segment=all`}
            >
              Fairness
            </Link>
          </div>
        );
      },
    },
  ];

  return (
    <section className="desk-stack">
      <AdminPageHeader
        title="Matching Runs"
        workspace={workspaceName ?? undefined}
        meta={
          <>
            {readySegments.length} of {segments.length} segments ready
            <span className="desk-sep">·</span>
            {runs.length} run{runs.length === 1 ? "" : "s"} recorded
          </>
        }
        description="A run reads the responses and the room list and writes a proposal. It is append-only: an earlier run is never edited, and a new run is a new artifact."
      />

      <div className="desk-directive">
        <div>
          <p className="desk-directive-line">
            {readySegments.length > 0
              ? `${readySegments.length} segment${readySegments.length === 1 ? "" : "s"} can be matched now.`
              : "Nothing is ready to match yet."}
          </p>
          {readySegments.length === 0 ? (
            <p className="desk-help" style={{ marginTop: 4, maxWidth: "58ch" }}>
              A segment is ready when everyone in it has answered and its beds cover its students. Fix
              the rows below, then run.
            </p>
          ) : null}
        </div>
        <Button
          disabled={runMutation.isPending || hasRunningRun || readySegments.length === 0}
          onClick={() => {
            void runMutation.mutateAsync({
              scope: "all_ready_segments",
              segment_key: null,
            });
          }}
        >
          <Play size={13} strokeWidth={1.8} aria-hidden="true" />
          {runMutation.isPending ? "Running…" : "Run All Ready Segments"}
        </Button>
      </div>

      {runMutation.isSuccess ? (
        runMutation.data.status === "completed" ? (
          <InlineAlert
            title="Matching run completed"
            message={`Run ${runMutation.data.run_id} finished with status ${runMutation.data.status}.`}
            tone="success"
            actions={
              <Button asChild size="sm" variant="outline">
                <Link
                  to={`/app/${workspaceId}/matching-runs/${encodeURIComponent(runMutation.data.run_id)}/rooms${
                    defaultSegmentKey ? `?segment=${encodeURIComponent(defaultSegmentKey)}` : ""
                  }`}
                >
                  Open the rooms
                </Link>
              </Button>
            }
          />
        ) : (
          <InlineAlert
            title="Matching run started"
            message="Results appear here when it finishes."
            tone="success"
          />
        )
      ) : null}

      {runMutation.isError ? (
        <InlineAlert
          title="The run did not complete"
          message={
            runMutation.error instanceof Error
              ? runMutation.error.message
              : "Matching run request failed."
          }
          tone="error"
        />
      ) : null}

      {(segmentsQuery.isError || runsQuery.isError) && (
        <InlineAlert
          title="Matching data is unavailable"
          message={
            (segmentsQuery.error instanceof Error && segmentsQuery.error.message) ||
            (runsQuery.error instanceof Error && runsQuery.error.message) ||
            "A matching data request failed."
          }
          tone="error"
          actions={
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void segmentsQuery.refetch();
                void runsQuery.refetch();
              }}
            >
              Try again
            </Button>
          }
        />
      )}

      <section className="desk-stack-sm" aria-labelledby="readiness-heading">
        <div className="desk-section-head">
          <h2 className="desk-section-title" id="readiness-heading">
            Segment Readiness
          </h2>
          <p className="desk-section-note">One row per boundary combination</p>
        </div>

        {segmentsQuery.isLoading ? (
          <div className="desk-stack-sm" aria-busy="true">
            <p className="desk-loading-note">Reading segments</p>
            <div className="desk-skel" style={{ height: 232 }} />
          </div>
        ) : segments.length === 0 && segmentsQuery.isSuccess ? (
          <EmptyState
            title="No segments yet"
            line="Segments are created from the roster: every gender, year group, AC type and room size combination becomes one."
            action={
              <Button asChild size="sm" variant="outline">
                <Link to={`/app/${workspaceId}/students-data`}>Upload the roster</Link>
              </Button>
            }
          />
        ) : (
          <DataTable
            caption="Segment readiness"
            columns={segmentColumns}
            emptyText={segmentsQuery.isLoading ? "Loading segments…" : "No segments available yet."}
            getRowId={(row) => row.segment_key}
            rows={segments}
          />
        )}
      </section>

      <section className="desk-stack-sm" aria-labelledby="history-heading">
        <div className="desk-section-head">
          <h2 className="desk-section-title" id="history-heading">
            Run history
          </h2>
          <p className="desk-section-note">Newest first</p>
        </div>

        {runsQuery.isLoading ? (
          <div className="desk-stack-sm" aria-busy="true">
            <p className="desk-loading-note">Reading run history</p>
            <div className="desk-skel" style={{ height: 96 }} />
          </div>
        ) : runs.length === 0 && runsQuery.isSuccess ? (
          <EmptyState
            title="No runs recorded"
            line="The first run writes the proposal. Until then the workspace has a roster and rooms but nothing to read."
          />
        ) : (
          <DataTable
            caption="Run history"
            columns={runColumns}
            emptyText={runsQuery.isLoading ? "Loading runs…" : "No runs recorded yet."}
            getRowId={(row) => row.run_id}
            rows={[...runs].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))}
          />
        )}
      </section>
    </section>
  );
}
