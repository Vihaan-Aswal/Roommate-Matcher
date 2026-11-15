import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";

import { AdminFairness } from "../../pages/AdminFairness";
import { FairnessReportsPage } from "../../pages/reports/FairnessReportsPage";
import { renderWithProviders } from "../renderWithProviders";

const { useAdminMatchingRunsQueryMock, useRunFairnessQueryMock } = vi.hoisted(() => ({
  useAdminMatchingRunsQueryMock: vi.fn(),
  useRunFairnessQueryMock: vi.fn(),
}));

vi.mock("../../hooks/useAdminMatchingRuns", () => ({
  useAdminMatchingRunsQuery: useAdminMatchingRunsQueryMock,
}));

vi.mock("../../hooks/useRunFairnessQuery", () => ({
  useRunFairnessQuery: useRunFairnessQueryMock,
}));

const refetchRunsMock = vi.fn();
const refetchFairnessMock = vi.fn();

const COMPLETED_RUN = {
  run_id: "run-100",
  created_at: "2026-03-30T10:00:00Z",
  started_at: "2026-03-30T10:00:05Z",
  finished_at: "2026-03-30T10:00:40Z",
  status: "completed",
  scope: "segment",
  segments_completed: 1,
  error_message: null,
};

const RUNNING_RUN = {
  run_id: "run-101",
  created_at: "2026-03-31T10:00:00Z",
  started_at: "2026-03-31T10:00:05Z",
  finished_at: null,
  status: "running",
  scope: "segment",
  segments_completed: 0,
  error_message: null,
};

const FAILED_RUN = {
  run_id: "run-099",
  created_at: "2026-03-29T10:00:00Z",
  started_at: "2026-03-29T10:00:05Z",
  finished_at: "2026-03-29T10:00:30Z",
  status: "failed",
  scope: "segment",
  segments_completed: 0,
  error_message: "engine failed",
};

const SEGMENT_ROW = {
  segment_key: "M_1st_year_AC_2",
  total_students: 10,
  label_counts: { Excellent: 2, Good: 4, Okay: 1, Poor: 3 },
  label_percentages: { Excellent: 0.2, Good: 0.4, Okay: 0.1, Poor: 0.3 },
  at_risk_count: 3,
  at_risk_student_ids: ["MR050", "MR051", "MR052"],
  minimum_satisfaction: 0.41,
};

const FAIRNESS = {
  run_id: "run-100",
  total_students: 10,
  run_label_counts: { Excellent: 2, Good: 4, Okay: 1, Poor: 3 },
  run_label_percentages: { Excellent: 0.2, Good: 0.4, Okay: 0.1, Poor: 0.3 },
  run_at_risk_count: 3,
  run_at_risk_student_ids: ["MR050", "MR051", "MR052"],
  by_segment: [SEGMENT_ROW],
  has_generated_profiles: false,
};

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

function runsQuery(overrides: Record<string, unknown> = {}) {
  return {
    isLoading: false,
    isError: false,
    data: { runs: [COMPLETED_RUN, RUNNING_RUN, FAILED_RUN] },
    error: null,
    refetch: refetchRunsMock,
    ...overrides,
  };
}

function fairnessQuery(overrides: Record<string, unknown> = {}) {
  return {
    isLoading: false,
    isError: false,
    data: FAIRNESS,
    error: null,
    refetch: refetchFairnessMock,
    ...overrides,
  };
}

describe("FairnessReportsPage through the AdminFairness wrapper", () => {
  beforeEach(() => {
    refetchRunsMock.mockReset();
    refetchFairnessMock.mockReset();
    useAdminMatchingRunsQueryMock.mockReturnValue(runsQuery());
    useRunFairnessQueryMock.mockReturnValue(fairnessQuery());
  });

  function renderFairness(initialEntry: string) {
    renderWithProviders(
      <Routes>
        <Route
          path="/app/:workspaceId/fairness"
          element={
            <>
              <AdminFairness />
              <LocationProbe />
            </>
          }
        />
        <Route
          path="/app/:workspaceId/fairness/:runId"
          element={
            <>
              <AdminFairness />
              <LocationProbe />
            </>
          }
        />
        <Route path="/app/:workspaceId/matching-runs/:runId/students" element={<LocationProbe />} />
        <Route path="/app/:workspaceId/matching-runs" element={<LocationProbe />} />
      </Routes>,
      { initialEntries: [initialEntry] },
    );
  }

  it("explains that no snapshot exists yet", () => {
    useAdminMatchingRunsQueryMock.mockReturnValue(
      runsQuery({ data: { runs: [FAILED_RUN] } }),
    );

    renderFairness("/app/ws_test/fairness");

    expect(screen.getByText("No fairness snapshot available")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open matching runs/i })).toHaveAttribute(
      "href",
      "/app/ws_test/matching-runs",
    );
  });

  it("opens the newest run when the route names none", () => {
    renderFairness("/app/ws_test/fairness?segment=all");

    expect(screen.getByTestId("location").textContent).toBe(
      "/app/ws_test/fairness/run-100?segment=all",
    );
  });

  it("reports unreadable runs and retries", () => {
    useAdminMatchingRunsQueryMock.mockReturnValue(
      runsQuery({ isError: true, data: undefined, error: new Error("runs failed") }),
    );

    renderFairness("/app/ws_test/fairness/run-100");

    expect(screen.getByText("Runs could not be read")).toBeInTheDocument();
    expect(screen.getByText("runs failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetchRunsMock).toHaveBeenCalledTimes(1);
  });

  it("shows the floor for the selected segment, not the whole run", () => {
    const otherSegment = {
      ...SEGMENT_ROW,
      segment_key: "F_1st_year_AC_2",
      minimum_satisfaction: 0.72,
      at_risk_count: 0,
      at_risk_student_ids: [],
    };
    useRunFairnessQueryMock.mockReturnValue(
      fairnessQuery({ data: { ...FAIRNESS, by_segment: [SEGMENT_ROW, otherSegment] } }),
    );

    renderFairness("/app/ws_test/fairness/run-100?segment=F_1st_year_AC_2");

    const lowest = screen.getByText("Lowest score").closest(".desk-figure");
    expect(lowest).not.toBeNull();
    expect(within(lowest as HTMLElement).getByText("72.0%")).toBeInTheDocument();
  });

  it("shows the floor while the snapshot is computed", () => {
    useRunFairnessQueryMock.mockReturnValue(
      fairnessQuery({ isLoading: true, data: undefined }),
    );

    renderFairness("/app/ws_test/fairness/run-100");

    expect(screen.getByText("Computing the floor")).toBeInTheDocument();
  });

  it("reports an unreadable snapshot and retries", () => {
    useRunFairnessQueryMock.mockReturnValue(
      fairnessQuery({ isError: true, data: undefined, error: new Error("fairness failed") }),
    );

    renderFairness("/app/ws_test/fairness/run-100");

    expect(screen.getByText("The fairness report could not be read")).toBeInTheDocument();
    expect(screen.getByText("fairness failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetchFairnessMock).toHaveBeenCalledTimes(1);
  });

  it("explains a run whose fairness breakdown is still empty", () => {
    useRunFairnessQueryMock.mockReturnValue(
      fairnessQuery({ data: { ...FAIRNESS, by_segment: [] } }),
    );

    renderFairness("/app/ws_test/fairness/run-100");

    expect(screen.getByText("This run has no fairness breakdown yet")).toBeInTheDocument();
  });

  it("reports the below-floor count and opens the at-risk student list", () => {
    renderFairness("/app/ws_test/fairness/run-100?segment=all");

    expect(
      screen.getByText(/3 of 10 students scored below the floor of 0\.55\./),
    ).toBeInTheDocument();
    expect(screen.getByText("Lowest score")).toBeInTheDocument();
    expect(screen.getAllByText("41.0%").length).toBeGreaterThan(0);
    expect(screen.queryByText("Generated data present")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /read the at-risk list/i }));

    expect(screen.getByTestId("location").textContent).toBe(
      "/app/ws_test/matching-runs/run-100/students?segment=all&label=all&atRisk=1",
    );
  });

  it("celebrates a run with nobody below the floor", () => {
    useRunFairnessQueryMock.mockReturnValue(
      fairnessQuery({
        data: { ...FAIRNESS, run_at_risk_count: 0, run_at_risk_student_ids: [] },
      }),
    );

    renderFairness("/app/ws_test/fairness/run-100?segment=all");

    expect(
      screen.getByText("Every one of the 10 students scored at or above the floor of 0.55."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open the at-risk view/i }));

    expect(screen.getByTestId("location").textContent).toBe(
      "/app/ws_test/matching-runs/run-100/students?segment=all&label=all&atRisk=1",
    );
  });

  it("warns when the snapshot includes generated profiles", () => {
    useRunFairnessQueryMock.mockReturnValue(
      fairnessQuery({ data: { ...FAIRNESS, has_generated_profiles: true } }),
    );

    renderFairness("/app/ws_test/fairness/run-100?segment=all");

    expect(screen.getByText("Generated data present")).toBeInTheDocument();
  });

  it("resets an unknown segment filter to all segments", () => {
    renderFairness("/app/ws_test/fairness/run-100?segment=not-a-segment");

    const location = screen.getByTestId("location").textContent ?? "";
    expect(location).toContain("segment=all");
  });

  it("switches run and segment through the selectors", () => {
    renderFairness("/app/ws_test/fairness/run-100?segment=all");

    fireEvent.change(screen.getByLabelText("Run"), { target: { value: "run-101" } });

    expect(screen.getByTestId("location").textContent).toBe(
      "/app/ws_test/fairness/run-101?segment=all",
    );

    fireEvent.change(screen.getByLabelText("Segment"), {
      target: { value: "M_1st_year_AC_2" },
    });

    expect(screen.getByTestId("location").textContent).toBe(
      "/app/ws_test/fairness/run-101?segment=M_1st_year_AC_2",
    );
  });

  it("drills from a segment card into that segment's at-risk and labelled students", () => {
    renderFairness("/app/ws_test/fairness/run-100?segment=all");

    const card = screen.getByRole("article");
    const atRiskButton = within(card).getByRole("button", { name: /3 at risk/i });
    expect(within(card).getByText("10 students")).toBeInTheDocument();

    fireEvent.click(atRiskButton);
    expect(screen.getByTestId("location").textContent).toBe(
      "/app/ws_test/matching-runs/run-100/students?segment=M_1st_year_AC_2&label=all&atRisk=1",
    );
  });

  it("drills from a segment card's label into the labelled students", async () => {
    renderFairness("/app/ws_test/fairness/run-100?segment=all");

    const card = screen.getByRole("article");
    fireEvent.click(within(card).getByRole("button", { name: /^Poor 3/i }));

    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe(
        "/app/ws_test/matching-runs/run-100/students?segment=M_1st_year_AC_2&label=Poor&atRisk=0",
      ),
    );
  });

  it("renders the report component directly", () => {
    renderWithProviders(
      <Routes>
        <Route path="/app/:workspaceId/fairness/:runId" element={<FairnessReportsPage />} />
      </Routes>,
      { initialEntries: ["/app/ws_test/fairness/run-100?segment=all"] },
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Reports & Fairness" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Run label distribution")).toBeInTheDocument();
  });
});
