// @vitest-environment node
import { describe, expect, it } from "vitest";

import { nextDashboardStep, responsesActionLabel, type DashboardReadiness } from "../lib/dashboardStep";

function readiness(overrides: Partial<DashboardReadiness> = {}): DashboardReadiness {
  return {
    workspaceId: "ws-1",
    hasRoster: true,
    hasRooms: true,
    collectionStarted: true,
    totalStudents: 4,
    validResponses: 4,
    readySegments: 1,
    totalSegments: 1,
    impossibleSegments: 0,
    riskySegments: 0,
    latestRunId: null,
    latestRunStatus: null,
    ...overrides,
  };
}

describe("nextDashboardStep", () => {
  it("sends missing responses to Form & Collection and names the act", () => {
    const notStarted = nextDashboardStep(
      readiness({ collectionStarted: false, validResponses: 0, readySegments: 0 }),
    );
    expect(notStarted.target).toBe("form-collection");
    expect(notStarted.label).toBe("Share the form");

    const started = nextDashboardStep(
      readiness({ validResponses: 2, readySegments: 0, riskySegments: 1 }),
    );
    expect(started.target).toBe("form-collection");
    expect(started.label).toBe("Chase 2 responses");
    expect(started.line).toContain("2 of 4 students have not answered");
  });

  it("sends an at-risk segment to Form & Collection even when nothing else is wrong", () => {
    const step = nextDashboardStep(readiness({ validResponses: 3, readySegments: 0, riskySegments: 1 }));
    expect(step.id).toBe("responses");
    expect(step.target).toBe("form-collection");
    expect(step.label).toBe("Chase 1 response");
  });

  it("sends a capacity gap to Students & Data for the room list", () => {
    const step = nextDashboardStep(
      readiness({ readySegments: 0, impossibleSegments: 1, validResponses: 4 }),
    );
    expect(step.id).toBe("capacity");
    expect(step.target).toBe("students-data");
    expect(step.label).toBe("Fix the room list");
    expect(step.to).toContain("/students-data");
  });

  it("sends a missing roster or room list to the matching upload", () => {
    const noRoster = nextDashboardStep(readiness({ hasRoster: false, totalStudents: 0 }));
    expect(noRoster.target).toBe("students-data");
    expect(noRoster.label).toBe("Upload the students file");

    const noRooms = nextDashboardStep(readiness({ hasRooms: false }));
    expect(noRooms.target).toBe("students-data");
    expect(noRooms.label).toBe("Add the room list");
  });

  it("keeps today's behaviour when a segment is ready", () => {
    const noRun = nextDashboardStep(readiness({ readySegments: 2, totalSegments: 4 }));
    expect(noRun.target).toBe("matching-runs");
    expect(noRun.label).toBe("Run matching");

    const completed = nextDashboardStep(
      readiness({ readySegments: 2, latestRunId: "run-9", latestRunStatus: "completed" }),
    );
    expect(completed.target).toBe("rooms");
    expect(completed.label).toBe("Read the proposal");
    expect(completed.to).toContain("/matching-runs/run-9/rooms");

    const running = nextDashboardStep(
      readiness({ readySegments: 1, latestRunId: "run-9", latestRunStatus: "running" }),
    );
    expect(running.target).toBe("matching-runs");
    expect(running.label).toBe("Open the latest run");
  });

  it("lets a ready segment win over a blocker, leaving the blocker to the note", () => {
    const step = nextDashboardStep(readiness({ readySegments: 2, riskySegments: 1 }));
    expect(step.id).toBe("run");
    expect(step.target).toBe("matching-runs");
  });

  it("never points a blocked workspace at Matching Runs", () => {
    const blocked: Array<Partial<DashboardReadiness>> = [
      { readySegments: 0, riskySegments: 1, validResponses: 1 },
      { readySegments: 0, impossibleSegments: 2, validResponses: 4 },
      { readySegments: 0, impossibleSegments: 1, riskySegments: 1 },
      { readySegments: 0, totalSegments: 0, validResponses: 0, collectionStarted: false },
      { hasRoster: false, readySegments: 0 },
      { hasRooms: false, readySegments: 0 },
    ];

    for (const state of blocked) {
      expect(nextDashboardStep(readiness(state)).target).not.toBe("matching-runs");
    }
  });

  it("says the count in the chase label, with a sane fallback", () => {
    expect(responsesActionLabel(0)).toBe("Chase the remaining responses");
    expect(responsesActionLabel(1)).toBe("Chase 1 response");
    expect(responsesActionLabel(12)).toBe("Chase 12 responses");
  });
});
