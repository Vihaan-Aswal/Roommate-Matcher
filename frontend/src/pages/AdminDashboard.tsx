import { Link } from "react-router-dom";

import { AdminPageHeader } from "../components/AdminPageHeader";
import { InlineAlert } from "../components/InlineAlert";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { useWorkspaceDashboardQuery } from "../hooks/useWorkspacesQuery";
import { useWorkspace } from "../providers/WorkspaceProvider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";

function yesNoLabel(value: boolean): string {
  return value ? "Ready" : "Pending";
}

function formatRunTime(value: string | null): string {
  if (!value) {
    return "No matching run recorded yet";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }

  return parsed.toLocaleString();
}

export function AdminDashboard(): JSX.Element {
  const { workspaceId, workspaceName } = useWorkspace();
  const dashboardQuery = useWorkspaceDashboardQuery(workspaceId || "");

  const actions = (
    <>
      <Button asChild size="sm" variant="outline">
        <Link to={`/app/${workspaceId}/students-data`}>Upload Data</Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link to={`/app/${workspaceId}/form-collection`}>View Form Collection</Link>
      </Button>
      <Button asChild size="sm" variant="accent">
        <Link to={`/app/${workspaceId}/matching-runs`}>Run Matching</Link>
      </Button>
    </>
  );

  return (
    <section className="space-y-6">
      <AdminPageHeader
        title={`${workspaceName || "Workspace"} Dashboard`}
        description="Track setup readiness, collection progress, and the latest run summary before triggering a new matching run."
        actions={actions}
      />

      {dashboardQuery.isLoading ? (
        <InlineAlert
          title="Loading dashboard"
          message="Fetching setup status and latest workflow signals."
          tone="info"
        />
      ) : null}

      {dashboardQuery.isError ? (
        <InlineAlert
          title="Unable to load dashboard"
          message={
            dashboardQuery.error instanceof Error
              ? dashboardQuery.error.message
              : "The dashboard request failed."
          }
          tone="error"
        />
      ) : null}

      {dashboardQuery.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Students"
              value={dashboardQuery.data.form_collection_stats.total_students}
            />
            <StatCard
              label="Valid Preferences"
              value={
                dashboardQuery.data.form_collection_stats
                  .students_with_valid_preferences
              }
            />
            <StatCard
              label="Collection Complete"
              value={`${dashboardQuery.data.form_collection_stats.percentage_complete}%`}
            />
            <StatCard
              label="Ready Segments"
              value={`${dashboardQuery.data.segments_status.ready}/${dashboardQuery.data.segments_status.total_segments}`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/80 bg-white/90">
              <CardHeader>
                <CardTitle className="text-lg">Setup Checklist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
                  <p className="text-sm text-foreground">
                    Master students uploaded
                  </p>
                  <StatusBadge
                    value={yesNoLabel(
                      dashboardQuery.data.setup_status.master_students_uploaded,
                    )}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
                  <p className="text-sm text-foreground">Rooms uploaded</p>
                  <StatusBadge
                    value={yesNoLabel(
                      dashboardQuery.data.setup_status.rooms_uploaded,
                    )}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
                  <p className="text-sm text-foreground">
                    Form collection started
                  </p>
                  <StatusBadge
                    value={yesNoLabel(
                      dashboardQuery.data.setup_status.forms_collection_started,
                    )}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
                  <p className="text-sm text-foreground">
                    At least one segment ready
                  </p>
                  <StatusBadge
                    value={yesNoLabel(
                      dashboardQuery.data.setup_status
                        .at_least_one_segment_ready,
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-white/90">
              <CardHeader>
                <CardTitle className="text-lg">Latest Matching Run</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Run ID
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {dashboardQuery.data.latest_matching_run.run_id ??
                      "No runs available"}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Status
                  </p>
                  <StatusBadge
                    value={
                      dashboardQuery.data.latest_matching_run.status ??
                      "Pending"
                    }
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Created At
                  </p>
                  <p className="text-sm text-foreground">
                    {formatRunTime(
                      dashboardQuery.data.latest_matching_run.created_at,
                    )}
                  </p>
                </div>

                {dashboardQuery.data.latest_matching_run.run_id ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to={`/app/${workspaceId}/matching-runs/${encodeURIComponent(
                          dashboardQuery.data.latest_matching_run.run_id,
                        )}/rooms`}
                      >
                        View Rooms
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to={`/app/${workspaceId}/matching-runs/${encodeURIComponent(
                          dashboardQuery.data.latest_matching_run.run_id,
                        )}/students?segment=all&label=all&atRisk=0`}
                      >
                        View Students
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to={`/app/${workspaceId}/fairness/${encodeURIComponent(
                          dashboardQuery.data.latest_matching_run.run_id,
                        )}?segment=all`}
                      >
                        View Fairness
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </section>
  );
}
