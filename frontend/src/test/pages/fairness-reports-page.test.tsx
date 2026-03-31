import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { vi } from "vitest";

import { FairnessReportsPage } from "../../pages/reports/FairnessReportsPage";

const {
  useAdminMatchingRunsQueryMock,
  useRunFairnessQueryMock,
} = vi.hoisted(() => ({
  useAdminMatchingRunsQueryMock: vi.fn(),
  useRunFairnessQueryMock: vi.fn(),
}));

vi.mock("../../hooks/useAdminMatchingRuns", () => ({
  useAdminMatchingRunsQuery: useAdminMatchingRunsQueryMock,
}));

vi.mock("../../hooks/useRunFairnessQuery", () => ({
  useRunFairnessQuery: useRunFairnessQueryMock,
}));

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

describe("FairnessReportsPage", () => {
  beforeEach(() => {
    useAdminMatchingRunsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        runs: [
          {
            run_id: "run-100",
            created_at: "2026-03-30T10:00:00Z",
            started_at: "2026-03-30T10:00:05Z",
            finished_at: "2026-03-30T10:00:40Z",
            status: "completed",
            scope: "segment",
            segments_completed: 1,
            error_message: null,
          },
        ],
      },
      error: null,
    });

    useRunFairnessQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        run_id: "run-100",
        total_students: 10,
        run_label_counts: {
          Excellent: 2,
          Good: 4,
          Okay: 1,
          Poor: 3,
        },
        run_label_percentages: {
          Excellent: 0.2,
          Good: 0.4,
          Okay: 0.1,
          Poor: 0.3,
        },
        run_at_risk_count: 3,
        run_at_risk_student_ids: ["MR050", "MR051", "MR052"],
        by_segment: [
          {
            segment_key: "M_1st_year_AC_2",
            total_students: 10,
            label_counts: {
              Excellent: 2,
              Good: 4,
              Okay: 1,
              Poor: 3,
            },
            label_percentages: {
              Excellent: 0.2,
              Good: 0.4,
              Okay: 0.1,
              Poor: 0.3,
            },
            at_risk_count: 3,
            at_risk_student_ids: ["MR050", "MR051", "MR052"],
            minimum_satisfaction: 0.41,
          },
        ],
      },
      error: null,
    });
  });

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/admin/fairness/run-100?segment=all"]}>
          <Routes>
            <Route
              path="/admin/fairness/:runId"
              element={
                <>
                  <FairnessReportsPage />
                  <LocationProbe />
                </>
              }
            />
            <Route
              path="/admin/matching-runs/:runId/students"
              element={<LocationProbe />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it("renders bar chart values from backend counts", () => {
    renderPage();

    expect(screen.getByText("Run label distribution")).toBeInTheDocument();
    expect(screen.getAllByText("Poor").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3 \(30.0%\)/).length).toBeGreaterThan(0);
  });

  it("drills through to student view with label filter", () => {
    renderPage();

    fireEvent.click(screen.getAllByRole("button", { name: /poor/i })[0]);

    expect(screen.getByTestId("location").textContent).toContain(
      "/admin/matching-runs/run-100/students?segment=all&label=Poor&atRisk=0",
    );
  });
});
