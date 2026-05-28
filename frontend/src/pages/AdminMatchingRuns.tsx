import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { magicFillWorkspace } from "../lib/apiClient";

import { AdminPageHeader } from "../components/AdminPageHeader";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { InlineAlert } from "../components/InlineAlert";
import { StatusBadge } from "../components/StatusBadge";
import {
  useAdminMatchingRunsQuery,
  useRunMatchingMutation,
} from "../hooks/useAdminMatchingRuns";
import { useAdminSegmentsQuery } from "../hooks/useAdminSegments";
import { useWorkspace } from "../providers/WorkspaceProvider";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }
  return parsed.toLocaleString();
}

export function AdminMatchingRuns(): JSX.Element {
  const { workspaceId } = useWorkspace();

  const segmentsQuery = useAdminSegmentsQuery(workspaceId!);
  const runsQuery = useAdminMatchingRunsQuery(workspaceId!);
  const runMutation = useRunMatchingMutation(workspaceId!);

  const [magicFillLoading, setMagicFillLoading] = useState(false);

  async function handleSegmentMagicFill(segmentKey: string) {
    if (!workspaceId) return;
    setMagicFillLoading(true);
    try {
      const result = await magicFillWorkspace(workspaceId, segmentKey);
      alert(`Segment ${segmentKey}: created ${result.profiles_created} profiles.`);
      segmentsQuery.refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Magic Fill failed.");
    } finally {
      setMagicFillLoading(false);
    }
  }

  const readySegments = useMemo(
    () =>
      (segmentsQuery.data?.segments ?? []).filter(
        (segment) => segment.status === "Ready",
      ),
    [segmentsQuery.data?.segments],
  );

  const defaultSegmentKey =
    segmentsQuery.data?.segments[0]?.segment_key ?? null;

  const segmentColumns: DataTableColumn<
    NonNullable<typeof segmentsQuery.data>["segments"][number]
  >[] = [
    {
      key: "segment_key",
      header: "Segment",
      cell: (row) => row.segment_key,
    },
    {
      key: "profile",
      header: "Profile",
      cell: (row) => `${row.gender} | ${row.year_group} | ${row.ac_type}`,
    },
    {
      key: "room_size",
      header: "Room Size",
      cell: (row) => row.room_size,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge value={row.status} />,
    },
    {
      key: "students",
      header: "Students",
      cell: (row) => row.student_count,
    },
    {
      key: "capacity",
      header: "Capacity",
      cell: (row) => row.total_capacity,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-2">
          <Button
            disabled={runMutation.isPending || row.status !== "Ready"}
            size="sm"
            variant="outline"
            onClick={() => {
              void runMutation.mutateAsync({
                scope: "segment",
                segment_key: row.segment_key,
              });
            }}
          >
            Run Segment
          </Button>
          <Button
            onClick={() => void handleSegmentMagicFill(row.segment_key)}
            disabled={magicFillLoading || row.status === "Ready"}
            size="sm"
            variant="outline"
            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
            title="Generate synthetic missing data"
          >
            ⚡ Fill Missing
          </Button>
        </div>
      ),
    },
  ];

  const runColumns: DataTableColumn<
    NonNullable<typeof runsQuery.data>["runs"][number]
  >[] = [
    {
      key: "run_id",
      header: "Run ID",
      cell: (row) => row.run_id,
    },
    {
      key: "scope",
      header: "Scope",
      cell: (row) => row.scope,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge value={row.status} />,
    },
    {
      key: "segments_completed",
      header: "Segments Completed",
      cell: (row) => row.segments_completed,
    },
    {
      key: "created_at",
      header: "Created At",
      cell: (row) => formatDateTime(row.created_at),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row) => {
        const canOpenResults = row.status === "completed";

        const roomRoute = defaultSegmentKey
          ? `/app/${workspaceId}/matching-runs/${encodeURIComponent(row.run_id)}/rooms?segment=${encodeURIComponent(defaultSegmentKey)}&needsReview=0`
          : "";
        const studentRoute = `/app/${workspaceId}/matching-runs/${encodeURIComponent(row.run_id)}/students?segment=all&label=all&atRisk=0`;
        const fairnessRoute = `/app/${workspaceId}/fairness/${encodeURIComponent(row.run_id)}?segment=all`;

        return (
          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              disabled={!canOpenResults || !defaultSegmentKey}
              size="sm"
              variant="outline"
            >
              <Link to={roomRoute || `/app/${workspaceId}/matching-runs`}>Room View</Link>
            </Button>
            <Button
              asChild
              disabled={!canOpenResults}
              size="sm"
              variant="outline"
            >
              <Link to={studentRoute}>Student View</Link>
            </Button>
            <Button
              asChild
              disabled={!canOpenResults}
              size="sm"
              variant="outline"
            >
              <Link to={fairnessRoute}>Fairness</Link>
            </Button>
          </div>
        );
      },
    },
  ];

  const actions = (
    <div className="flex gap-2">
      <Button
        disabled={runMutation.isPending || readySegments.length === 0}
        size="sm"
        variant="accent"
        onClick={() => {
          void runMutation.mutateAsync({
            scope: "all_ready_segments",
            segment_key: null,
          });
        }}
      >
        {runMutation.isPending ? "Running..." : "Run All Ready Segments"}
      </Button>
    </div>
  );

  return (
    <section className="space-y-6">
      <AdminPageHeader
        title="Matching Runs"
        description="Trigger matching for a single ready segment or execute all ready segments in one run."
        actions={actions}
      />

      {runMutation.isSuccess ? (
        <InlineAlert
          title="Matching run started"
          message={`Run ${runMutation.data.run_id} completed with status ${runMutation.data.status}.`}
          tone="success"
        />
      ) : null}

      {runMutation.isError ? (
        <InlineAlert
          title="Matching run failed"
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
          title="Unable to load matching data"
          message={
            (segmentsQuery.error instanceof Error &&
              segmentsQuery.error.message) ||
            (runsQuery.error instanceof Error && runsQuery.error.message) ||
            "A matching data request failed."
          }
          tone="error"
        />
      )}

      <Card className="border-border/80 bg-white/90">
        <CardHeader>
          <CardTitle className="text-lg">Segment Readiness</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={segmentColumns}
            emptyText={
              segmentsQuery.isLoading
                ? "Loading segments..."
                : "No segments available yet."
            }
            getRowId={(row) => row.segment_key}
            rows={segmentsQuery.data?.segments ?? []}
          />
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-white/90">
        <CardHeader>
          <CardTitle className="text-lg">Run History</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={runColumns}
            emptyText={
              runsQuery.isLoading ? "Loading runs..." : "No runs recorded yet."
            }
            getRowId={(row) => row.run_id}
            rows={runsQuery.data?.runs ?? []}
          />
        </CardContent>
      </Card>
    </section>
  );
}
