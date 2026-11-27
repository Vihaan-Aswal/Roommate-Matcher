import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";

import { AdminAtRiskReview } from "../../pages/AdminAtRiskReview";
import { WorkspaceContext } from "../../providers/WorkspaceProvider";

const { useAdminMatchingRunsQueryMock } = vi.hoisted(() => ({
  useAdminMatchingRunsQueryMock: vi.fn(),
}));

vi.mock("../../hooks/useAdminMatchingRuns", () => ({
  useAdminMatchingRunsQuery: useAdminMatchingRunsQueryMock,
}));

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

function renderPage(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[initialEntry]}
      >
        <WorkspaceContext.Provider
          value={{
            workspaceId: "ws_test",
            workspaceName: "Test Workspace",
            navigateToWorkspace: () => {},
          }}
        >
          <Routes>
            <Route
              path="/app/:workspaceId/at-risk-review"
              element={
                <>
                  <AdminAtRiskReview />
                  <LocationProbe />
                </>
              }
            />
            <Route
              path="/app/:workspaceId/matching-runs/:runId/students"
              element={<LocationProbe />}
            />
            <Route path="/app/:workspaceId/matching-runs" element={<LocationProbe />} />
          </Routes>
        </WorkspaceContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminAtRiskReview", () => {
  beforeEach(() => {
    useAdminMatchingRunsQueryMock.mockReset();
  });

  it("explains the empty state and points at matching runs when no completed run exists", () => {
    useAdminMatchingRunsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        runs: [
          {
            run_id: "run-failed",
            created_at: "2026-03-30T10:00:00Z",
            started_at: "2026-03-30T10:00:05Z",
            finished_at: null,
            status: "failed",
            scope: "segment",
            segments_completed: 0,
            error_message: "boom",
          },
        ],
      },
      error: null,
    });

    renderPage("/app/ws_test/at-risk-review");

    expect(
      screen.getByRole("heading", { level: 1, name: "At-Risk Review" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No completed run yet")).toBeInTheDocument();
    expect(
      screen.getByText(/run matching at least once/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open matching runs/i })).toHaveAttribute(
      "href",
      "/app/ws_test/matching-runs",
    );
    expect(screen.getByTestId("location").textContent).toBe("/app/ws_test/at-risk-review");
  });

  it("resolves the newest completed run and opens the at-risk student list with the segment filter", () => {
    useAdminMatchingRunsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        runs: [
          {
            run_id: "run-newest",
            created_at: "2026-03-30T10:00:00Z",
            started_at: "2026-03-30T10:00:05Z",
            finished_at: "2026-03-30T10:00:40Z",
            status: "completed",
            scope: "all_ready_segments",
            segments_completed: 2,
            error_message: null,
          },
          {
            run_id: "run-older",
            created_at: "2026-03-29T10:00:00Z",
            started_at: "2026-03-29T10:00:05Z",
            finished_at: "2026-03-29T10:00:40Z",
            status: "completed",
            scope: "segment",
            segments_completed: 1,
            error_message: null,
          },
        ],
      },
      error: null,
    });

    renderPage("/app/ws_test/at-risk-review?segment=M_1st_year_AC_2");

    expect(screen.getByTestId("location").textContent).toBe(
      "/app/ws_test/matching-runs/run-newest/students?segment=M_1st_year_AC_2&label=all&atRisk=1",
    );
  });

  it("honours an explicitly requested run even while the run history is still loading", () => {
    useAdminMatchingRunsQueryMock.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
      error: null,
    });

    renderPage("/app/ws_test/at-risk-review?run=run-explicit");

    expect(screen.getByTestId("location").textContent).toBe(
      "/app/ws_test/matching-runs/run-explicit/students?segment=all&label=all&atRisk=1",
    );
  });
});
