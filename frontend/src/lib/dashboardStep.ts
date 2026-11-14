/**
 * dashboardStep.ts — the dashboard's next action, derived from real state only.
 *
 * The rule: the action must point at whatever is blocking the workspace, not at
 * the page where the blockage becomes visible. A directive that says "open
 * matching runs" when nothing there can run is worse than no directive.
 *
 * Priority (first match wins):
 *   1. no roster .................. upload the students file   -> Students & Data
 *   2. no room list ............... add the room list          -> Students & Data
 *   3. collection not started ..... share the form             -> Form & Collection
 *   4. at least one segment ready . run / read the proposal    -> Matching Runs (unchanged)
 *   5. capacity gap ............... fix the room list          -> Students & Data
 *   6. segments at risk ........... chase the responses        -> Form & Collection
 *   7. no segments at all ......... check the roster file      -> Students & Data
 *   8. anything else .............. open matching runs         -> Matching Runs
 *
 * Ready wins over blockers on purpose: if something can run, the desk should let
 * it run, and the blockers are still listed under it with their own actions.
 */

export type DashboardTarget = "students-data" | "form-collection" | "matching-runs" | "rooms";

export interface DashboardReadiness {
  workspaceId: string;
  hasRoster: boolean;
  hasRooms: boolean;
  collectionStarted: boolean;
  totalStudents: number;
  validResponses: number;
  readySegments: number;
  totalSegments: number;
  impossibleSegments: number;
  riskySegments: number;
  latestRunId: string | null;
  latestRunStatus: string | null;
}

export interface DashboardStep {
  /** Which condition produced this step; the note uses it to avoid repeating itself. */
  id:
    | "roster"
    | "rooms"
    | "collection"
    | "run"
    | "proposal"
    | "latest-run"
    | "capacity"
    | "responses"
    | "segments"
    | "fallback";
  line: string;
  label: string;
  target: DashboardTarget;
  to: string;
}

export function outstandingResponses(input: {
  totalStudents: number;
  validResponses: number;
}): number {
  return Math.max(0, input.totalStudents - input.validResponses);
}

/** "Chase 2 responses" — names the act, with the count when there is one. */
export function responsesActionLabel(outstanding: number): string {
  if (outstanding <= 0) {
    return "Chase the remaining responses";
  }
  return `Chase ${outstanding} response${outstanding === 1 ? "" : "s"}`;
}

export function nextDashboardStep(input: DashboardReadiness): DashboardStep {
  const base = `/app/${input.workspaceId}`;
  const outstanding = outstandingResponses(input);

  if (!input.hasRoster) {
    return {
      id: "roster",
      line: "No student roster yet. Upload the students file to start the workspace.",
      label: "Upload the students file",
      target: "students-data",
      to: `${base}/students-data`,
    };
  }

  if (!input.hasRooms) {
    return {
      id: "rooms",
      line: "The roster is in. Add the room list so each segment knows its capacity.",
      label: "Add the room list",
      target: "students-data",
      to: `${base}/students-data`,
    };
  }

  if (!input.collectionStarted) {
    return {
      id: "collection",
      line: "Rooms and students are in. Share the form link so responses can arrive.",
      label: "Share the form",
      target: "form-collection",
      to: `${base}/form-collection`,
    };
  }

  if (input.readySegments > 0) {
    if (!input.latestRunId) {
      return {
        id: "run",
        line: `${input.readySegments} of ${input.totalSegments} segments are ready. Nothing has been proposed yet.`,
        label: "Run matching",
        target: "matching-runs",
        to: `${base}/matching-runs`,
      };
    }

    if (input.latestRunStatus === "completed") {
      return {
        id: "proposal",
        line: "A proposal exists for this workspace. Read the rooms, then the students who scored lowest.",
        label: "Read the proposal",
        target: "rooms",
        to: `${base}/matching-runs/${encodeURIComponent(input.latestRunId)}/rooms`,
      };
    }

    return {
      id: "latest-run",
      line: `The latest run is ${input.latestRunStatus ?? "in progress"}. Open it for status and output.`,
      label: "Open the latest run",
      target: "matching-runs",
      to: `${base}/matching-runs`,
    };
  }

  if (input.impossibleSegments > 0) {
    return {
      id: "capacity",
      line: `${input.impossibleSegments} ${
        input.impossibleSegments === 1 ? "segment has more students than beds" : "segments have more students than beds"
      }. Fix the room list, then run again.`,
      label: "Fix the room list",
      target: "students-data",
      to: `${base}/students-data`,
    };
  }

  if (input.riskySegments > 0) {
    return {
      id: "responses",
      line: `No segment can run yet: ${outstanding} of ${input.totalStudents} students have not answered.`,
      label: responsesActionLabel(outstanding),
      target: "form-collection",
      to: `${base}/form-collection`,
    };
  }

  if (input.totalSegments === 0) {
    return {
      id: "segments",
      line: "No segments exist yet. They appear once the roster has students with year, gender and room type.",
      label: "Check the roster file",
      target: "students-data",
      to: `${base}/students-data`,
    };
  }

  return {
    id: "fallback",
    line: "No segment is ready to run yet. A segment is ready when it has students, rooms and no capacity gap.",
    label: "Open matching runs",
    target: "matching-runs",
    to: `${base}/matching-runs`,
  };
}
