import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Inbox, Sparkles } from "lucide-react";

import { AdminPageHeader } from "../components/AdminPageHeader";
import { magicFillWorkspace } from "../lib/apiClient";
import { nextDashboardStep, outstandingResponses, responsesActionLabel } from "../lib/dashboardStep";
import DataWarningBanner from "../components/DataWarningBanner";
import { InlineAlert } from "../components/InlineAlert";
import { useToast } from "../hooks/use-toast";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { useWorkspaceDashboardQuery } from "../hooks/useWorkspacesQuery";
import { useWorkspace } from "../providers/WorkspaceProvider";
import { Button } from "../components/ui/button";

function formatRunTime(value: string | null | undefined): string {
  if (!value) {
    return "No run recorded yet";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatPercent(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  const rounded = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return `${rounded}%`;
}

/**
 * Readiness vocabulary — one word per condition, four rules:
 *
 *   Missing      nothing for this stage exists yet                    (quiet)
 *   In progress  the input exists, the stage's condition is unmet      (plain)
 *   Ready        the stage's condition is met                          (wax mark)
 *   Risk / Impossible  a segment-level blocker reported by the API     (amber)
 *
 * "Complete" was removed: on the Responses stage it meant exactly what "Ready"
 * means. Partial completion is "In progress", and the detail line carries the
 * count ("3 of 4 ready to match").
 */
type ReadinessState = "Missing" | "In progress" | "Ready" | "Risk" | "Impossible";

function stageTone(state: ReadinessState): "ready" | "pending" | "attention" {
  if (state === "Ready") return "ready";
  if (state === "Risk" || state === "Impossible") return "attention";
  return "pending";
}

export function AdminDashboard(): JSX.Element {
  const { workspaceId, workspaceName } = useWorkspace();
  const dashboardQuery = useWorkspaceDashboardQuery(workspaceId || "");
  const { toast } = useToast();

  const [magicFillLoading, setMagicFillLoading] = useState(false);

  async function handleMagicFillAll() {
    if (!workspaceId) return;
    setMagicFillLoading(true);
    try {
      const result = await magicFillWorkspace(workspaceId, null);
      toast({
        title: "Magic Fill complete",
        description: `Created ${result.profiles_created} generated profiles across this workspace.`,
      });
      dashboardQuery.refetch();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Magic Fill failed",
        description: err instanceof Error ? err.message : "Magic Fill failed.",
      });
    } finally {
      setMagicFillLoading(false);
    }
  }

  const data = dashboardQuery.data;
  const setup = data?.setup_status ?? ({} as Record<string, boolean>);
  const stats = data?.form_collection_stats;
  const segments = data?.segments_status;
  const run = data?.latest_matching_run;

  const hasRoster = Boolean(setup.master_students_uploaded);
  const hasRooms = Boolean(setup.rooms_uploaded);
  const collectionStarted = Boolean(setup.forms_collection_started);
  const readySegments = segments?.ready ?? 0;
  const totalSegments = segments?.total_segments ?? 0;
  const impossibleSegments = segments?.impossible ?? 0;
  const riskySegments = segments?.at_risk ?? 0;
  const runId = run?.run_id ?? null;

  const responsesComplete =
    Boolean(stats) &&
    (stats?.total_students ?? 0) > 0 &&
    (stats?.students_with_valid_preferences ?? 0) >= (stats?.total_students ?? 0);

  const rosterState: ReadinessState = hasRoster ? "Ready" : "Missing";
  const roomsState: ReadinessState = hasRooms ? "Ready" : "Missing";
  const responsesState: ReadinessState = !collectionStarted
    ? "Missing"
    : responsesComplete
      ? "Ready"
      : "In progress";
  const segmentsState: ReadinessState =
    impossibleSegments > 0
      ? "Impossible"
      : riskySegments > 0
        ? "Risk"
        : totalSegments === 0
          ? "Missing"
          : readySegments > 0
            ? "Ready"
            : "In progress";

  /** The one thing this page should ask for next — and the page that can unblock it. */
  const step = nextDashboardStep({
    workspaceId: workspaceId ?? "",
    hasRoster,
    hasRooms,
    collectionStarted,
    totalStudents: stats?.total_students ?? 0,
    validResponses: stats?.students_with_valid_preferences ?? 0,
    readySegments,
    totalSegments,
    impossibleSegments,
    riskySegments,
    latestRunId: runId,
    latestRunStatus: run?.status ?? null,
  });

  const outstanding = outstandingResponses({
    totalStudents: stats?.total_students ?? 0,
    validResponses: stats?.students_with_valid_preferences ?? 0,
  });

  /**
   * The note carries only the blockers the directive is not already about, so a
   * blocker never gets two actions and the page never says the same thing twice.
   */
  const noteBlockers = [
    impossibleSegments > 0 && step.id !== "capacity"
      ? {
          key: "capacity",
          line:
            impossibleSegments === 1
              ? "1 segment cannot be matched: not enough room capacity for the students in it."
              : `${impossibleSegments} segments cannot be matched: not enough room capacity for the students in them.`,
          label: "Fix the room list",
          to: `/app/${workspaceId}/students-data`,
        }
      : null,
    riskySegments > 0 && step.id !== "responses"
      ? {
          key: "responses",
          line:
            riskySegments === 1
              ? "1 segment is at risk: more than 20% of its students have no response."
              : `${riskySegments} segments are at risk: more than 20% of their students have no response.`,
          label: responsesActionLabel(outstanding),
          to: `/app/${workspaceId}/form-collection`,
        }
      : null,
  ].filter((blocker): blocker is NonNullable<typeof blocker> => blocker !== null);

  const collectionRatio =
    typeof stats?.percentage_complete === "number" ? Math.min(100, Math.max(0, stats.percentage_complete)) : 0;

  return (
    <section className="desk-stack">
      <AdminPageHeader
        title="Dashboard"
        workspace={workspaceName ?? undefined}
        meta={<>{totalSegments} segments</>}
        description="Four stages stand between this workspace and a proposal. Each one opens the page that moves it."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to={`/app/${workspaceId}/students-data`}>Upload data</Link>
          </Button>
        }
      />

      {dashboardQuery.isLoading ? (
        <div className="desk-stack" aria-busy="true">
          <p className="desk-loading-note">Reading the workspace</p>
          <div className="desk-skel" style={{ height: 84 }} />
          <div className="desk-skel" style={{ height: 148 }} />
          <div className="desk-skel" style={{ height: 120 }} />
        </div>
      ) : null}

      {dashboardQuery.isError ? (
        <InlineAlert
          title="The workspace could not be read"
          message={
            dashboardQuery.error instanceof Error
              ? dashboardQuery.error.message
              : "The dashboard request failed."
          }
          tone="error"
          actions={
            <Button size="sm" variant="outline" onClick={() => void dashboardQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : null}

      {data ? (
        <>
          {data.generated_data_warning?.has_generated_data ? (
            <DataWarningBanner hasGeneratedProfiles={true} context="dashboard" />
          ) : null}

          <div className="desk-directive">
            <p className="desk-directive-line">{step.line}</p>
            <Button asChild>
              <Link to={step.to}>
                {step.label}
                <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <div className="desk-figures">
            <StatCard
              label="Total Students"
              value={stats?.total_students ?? 0}
              hint="on the roster"
            />
            <StatCard
              label="Valid Preferences"
              value={stats?.students_with_valid_preferences ?? 0}
              hint="responses that count"
            />
            <StatCard
              label="Collection"
              value={formatPercent(stats?.percentage_complete)}
              hint="of the roster has answered"
            />
            <StatCard
              label="Ready Segments"
              value={`${readySegments}/${totalSegments}`}
              hint="ready to match"
            />
          </div>

          <div className="desk-section" style={{ marginTop: 4 }}>
            <div className="desk-section-head">
              <h2 className="desk-section-title">Readiness</h2>
            </div>
            <div className="desk-stages">
              <Link
                className="desk-stage"
                data-state={stageTone(rosterState)}
                to={`/app/${workspaceId}/students-data`}
              >
                <span className="desk-stage-top">
                  <span className="desk-stage-step">01</span>
                  <StatusBadge value={rosterState} />
                </span>
                <span className="desk-stage-name">Roster</span>
                <span className="desk-stage-value">
                  {hasRoster ? "Students uploaded" : "No students yet"}
                </span>
                <span className="desk-stage-rule" />
              </Link>

              <Link
                className="desk-stage"
                data-state={stageTone(roomsState)}
                to={`/app/${workspaceId}/students-data`}
              >
                <span className="desk-stage-top">
                  <span className="desk-stage-step">02</span>
                  <StatusBadge value={roomsState} />
                </span>
                <span className="desk-stage-name">Rooms</span>
                <span className="desk-stage-value">
                  {hasRooms ? "Room list uploaded" : "No rooms yet"}
                </span>
                <span className="desk-stage-rule" />
              </Link>

              <Link
                className="desk-stage"
                data-state={stageTone(responsesState)}
                to={`/app/${workspaceId}/form-collection`}
              >
                <span className="desk-stage-top">
                  <span className="desk-stage-step">03</span>
                  <StatusBadge value={responsesState} />
                </span>
                <span className="desk-stage-name">Responses</span>
                <span className="desk-stage-value">
                  {stats
                    ? `${stats.students_with_valid_preferences} of ${stats.total_students} answered`
                    : "No responses yet"}
                </span>
                <span className="desk-stage-rule" />
              </Link>

              <Link
                className="desk-stage"
                data-state={stageTone(segmentsState)}
                to={`/app/${workspaceId}/matching-runs`}
              >
                <span className="desk-stage-top">
                  <span className="desk-stage-step">04</span>
                  <StatusBadge value={segmentsState} />
                </span>
                <span className="desk-stage-name">Segments</span>
                <span className="desk-stage-value">
                  {readySegments} of {totalSegments} ready to match
                </span>
                <span className="desk-stage-rule" />
              </Link>
            </div>
          </div>

          {noteBlockers.length > 0 ? (
            <div className="desk-note" data-tone="attention">
              <div className="desk-stack-sm">
                {noteBlockers.map((blocker) => (
                  <div className="desk-row-between" style={{ gap: 12 }} key={blocker.key}>
                    <p className="desk-note-body" style={{ maxWidth: "58ch" }}>
                      {blocker.line}
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link to={blocker.to}>{blocker.label}</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="desk-section">
            <div className="desk-section-head">
              <h2 className="desk-section-title">Latest run</h2>
            </div>

            {runId ? (
              <div className="desk-cols desk-cols-wide-left">
                <div className="desk-stack-sm">
                  <dl className="desk-kv">
                    <dt>Run</dt>
                    <dd className="desk-mono">{runId}</dd>
                    <dt>Status</dt>
                    <dd>
                      <StatusBadge value={run?.status ?? "Pending"} />
                    </dd>
                    <dt>Created</dt>
                    <dd>{formatRunTime(run?.created_at)}</dd>
                  </dl>
                  <p className="desk-help">
                    A run is append-only. Reading it does not change a room, an assignment or a student record.
                  </p>
                </div>
                <div className="desk-list">
                  <Link
                    className="desk-list-row"
                    to={`/app/${workspaceId}/matching-runs/${encodeURIComponent(runId)}/rooms`}
                  >
                    <span className="desk-list-main">
                      <span className="desk-list-title">Rooms</span>
                      <span className="desk-list-meta">Every proposed room, its score and its pair scores</span>
                    </span>
                    <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
                  </Link>
                  <Link
                    className="desk-list-row"
                    to={`/app/${workspaceId}/matching-runs/${encodeURIComponent(runId)}/students?segment=all&label=all&atRisk=0`}
                  >
                    <span className="desk-list-main">
                      <span className="desk-list-title">Students</span>
                      <span className="desk-list-meta">Each student's room, score and written reasons</span>
                    </span>
                    <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
                  </Link>
                  <Link
                    className="desk-list-row"
                    to={`/app/${workspaceId}/fairness/${encodeURIComponent(runId)}?segment=all`}
                  >
                    <span className="desk-list-main">
                      <span className="desk-list-title">Fairness</span>
                      <span className="desk-list-meta">The floor: distribution, at-risk list, weakest room</span>
                    </span>
                    <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No run recorded yet"
                line="Matching runs are written when you run a ready segment. Until then there is nothing to read here."
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/app/${workspaceId}/matching-runs`}>Open matching runs</Link>
                  </Button>
                }
              />
            )}
          </div>

          <details className="desk-disclosure desk-section">
            <summary>
              <span className="desk-row" style={{ gap: 8 }}>
                <Sparkles size={13} strokeWidth={1.8} aria-hidden="true" />
                Magic Fill (generated data)
              </span>
            </summary>
            <div className="desk-stack-sm" style={{ paddingBottom: 8 }}>
              <p className="desk-help" style={{ maxWidth: "62ch" }}>
                Magic Fill writes synthetic preference profiles for students who have not answered. It is useful
                for a rehearsal, and misleading for a real allocation: the results will be flagged as containing
                generated data.
              </p>
              <div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleMagicFillAll()}
                  disabled={magicFillLoading}
                >
                  <Inbox size={13} strokeWidth={1.8} aria-hidden="true" />
                  {magicFillLoading ? "Filling…" : "Fill missing profiles"}
                </Button>
              </div>
            </div>
          </details>
        </>
      ) : null}
    </section>
  );
}
