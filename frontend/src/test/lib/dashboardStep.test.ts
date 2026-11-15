// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  nextDashboardStep,
  outstandingResponses,
  responsesActionLabel,
  type DashboardReadiness,
} from "../../lib/dashboardStep";

function readiness(overrides: Partial<DashboardReadiness> = {}): DashboardReadiness {
  return {
    workspaceId: "ws-1",
    hasRoster: true,
    hasRooms: true,
    collectionStarted: true,
    totalStudents: 6,
    validResponses: 6,
    readySegments: 0,
    totalSegments: 2,
    impossibleSegments: 0,
    riskySegments: 0,
    latestRunId: null,
    latestRunStatus: null,
    ...overrides,
  };
}

describe("outstandingResponses", () => {
  it("counts the students who have not answered", () => {
    expect(outstandingResponses({ totalStudents: 10, validResponses: 4 })).toBe(6);
  });

  it("never reports a negative backlog when responses exceed the roster", () => {
    expect(outstandingResponses({ totalStudents: 2, validResponses: 5 })).toBe(0);
  });
});

describe("responsesActionLabel", () => {
  it("names the act with a singular or plural count", () => {
    expect(responsesActionLabel(0)).toBe("Chase the remaining responses");
    expect(responsesActionLabel(1)).toBe("Chase 1 response");
    expect(responsesActionLabel(7)).toBe("Chase 7 responses");
  });
});

describe("nextDashboardStep — branch coverage beyond the happy paths", () => {
  it("asks for the students file before anything else", () => {
    const step = nextDashboardStep(readiness({ hasRoster: false, hasRooms: false }));

    expect(step.id).toBe("roster");
    expect(step.label).toBe("Upload the students file");
    expect(step.to).toBe("/app/ws-1/students-data");
  });

  it("asks for the room list once the roster exists", () => {
    const step = nextDashboardStep(readiness({ hasRooms: false }));

    expect(step.id).toBe("rooms");
    expect(step.label).toBe("Add the room list");
    expect(step.to).toBe("/app/ws-1/students-data");
  });

  it("chases responses when a segment is at risk and nothing else is blocking", () => {
    const step = nextDashboardStep(readiness({ validResponses: 2, riskySegments: 1 }));

    expect(step.id).toBe("responses");
    expect(step.label).toBe("Chase 4 responses");
    expect(step.line).toBe("No segment can run yet: 4 of 6 students have not answered.");
    expect(step.to).toBe("/app/ws-1/form-collection");
  });

  it("reports each capacity gap in the singular and the plural", () => {
    const one = nextDashboardStep(readiness({ impossibleSegments: 1 }));
    expect(one.id).toBe("capacity");
    expect(one.line).toBe("1 segment has more students than beds. Fix the room list, then run again.");

    const many = nextDashboardStep(readiness({ impossibleSegments: 3 }));
    expect(many.line).toBe("3 segments have more students than beds. Fix the room list, then run again.");
  });

  it("names an in-progress latest run when the status is unknown", () => {
    const step = nextDashboardStep(
      readiness({ readySegments: 1, latestRunId: "run-1", latestRunStatus: null }),
    );

    expect(step.id).toBe("latest-run");
    expect(step.line).toContain("in progress");
    expect(step.to).toBe("/app/ws-1/matching-runs");
  });

  it("names a failed latest run by its status", () => {
    const step = nextDashboardStep(
      readiness({ readySegments: 1, latestRunId: "run-1", latestRunStatus: "failed" }),
    );

    expect(step.id).toBe("latest-run");
    expect(step.line).toBe("The latest run is failed. Open it for status and output.");
  });

  it("encodes the run id in the proposal link", () => {
    const step = nextDashboardStep(
      readiness({ readySegments: 1, latestRunId: "run/1 a", latestRunStatus: "completed" }),
    );

    expect(step.id).toBe("proposal");
    expect(step.to).toBe("/app/ws-1/matching-runs/run%2F1%20a/rooms");
  });

  it("counts ready segments in the run line", () => {
    const step = nextDashboardStep(readiness({ readySegments: 2, totalSegments: 5 }));

    expect(step.id).toBe("run");
    expect(step.line).toBe("2 of 5 segments are ready. Nothing has been proposed yet.");
  });

  it("asks for the roster file when no segment exists at all", () => {
    const step = nextDashboardStep(readiness({ totalSegments: 0 }));

    expect(step.id).toBe("segments");
    expect(step.label).toBe("Check the roster file");
    expect(step.to).toBe("/app/ws-1/students-data");
  });

  it("falls back to opening matching runs when nothing is blocking and nothing is ready", () => {
    const step = nextDashboardStep(readiness());

    expect(step.id).toBe("fallback");
    expect(step.target).toBe("matching-runs");
    expect(step.label).toBe("Open matching runs");
    expect(step.to).toBe("/app/ws-1/matching-runs");
  });

  it("keeps the collection step on the form page", () => {
    const step = nextDashboardStep(readiness({ collectionStarted: false }));

    expect(step.id).toBe("collection");
    expect(step.to).toBe("/app/ws-1/form-collection");
  });
});
