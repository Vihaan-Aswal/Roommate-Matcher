import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";

import { StudentResultsPage } from "../../pages/matching/StudentResultsPage";
import { WorkspaceContext } from "../../providers/WorkspaceProvider";

const {
  useAdminSegmentsQueryMock,
  useRunStudentsQueryMock,
  useRunStudentsAcrossSegmentsQueryMock,
} = vi.hoisted(() => ({
  useAdminSegmentsQueryMock: vi.fn(),
  useRunStudentsQueryMock: vi.fn(),
  useRunStudentsAcrossSegmentsQueryMock: vi.fn(),
}));

vi.mock("../../hooks/useAdminSegments", () => ({
  useAdminSegmentsQuery: useAdminSegmentsQueryMock,
}));

vi.mock("../../hooks/useRunStudentsQuery", () => ({
  useRunStudentsQuery: useRunStudentsQueryMock,
}));

vi.mock("../../hooks/useRunStudentsAcrossSegmentsQuery", () => ({
  useRunStudentsAcrossSegmentsQuery: useRunStudentsAcrossSegmentsQueryMock,
}));

vi.mock("../../providers/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    workspaceId: "ws_test",
    workspaceName: "Test Workspace",
    navigateToWorkspace: vi.fn(),
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <p data-testid="location-probe">{`${location.pathname}${location.search}`}</p>
  );
}

describe("phase 7 deep links", () => {
  beforeEach(() => {
    useAdminSegmentsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        segments: [
          {
            segment_key: "M_1st_year_AC_2",
            gender: "M",
            year_group: "1st_year",
            ac_type: "AC",
            room_size: 2,
            status: "Ready",
            student_count: 10,
            total_capacity: 10,
            missing_preferences_count: 0,
            missing_preferences_ratio: 0,
          },
        ],
      },
      error: null,
    });

    useRunStudentsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        students: [
          {
            admission_number: "MR010",
            full_name: "Student Ten",
            room_id: "A-201",
            roommate_ids: ["MR011"],
            satisfaction_score: 0.35,
            satisfaction_label: "Poor",
            is_at_risk: true,
            reasons: ["Mismatch"],
            factor_trace: [
              {
                factor_key: "q2_enc",
                factor_class: "Strong Mismatch",
                reason_bucket: "tidiness",
                polarity: "mismatch",
                template_id: "tidiness_mismatch",
                claim_scope: "student_specific_claim",
              },
            ],
          },
          {
            admission_number: "MR002",
            full_name: "Student Two",
            room_id: "A-202",
            roommate_ids: ["MR001"],
            satisfaction_score: 0.82,
            satisfaction_label: "Excellent",
            is_at_risk: false,
            reasons: ["Strong match"],
            factor_trace: [
              {
                factor_key: "q1_enc",
                factor_class: "Strong Match",
                reason_bucket: "sleep_sync",
                polarity: "strong_positive",
                template_id: "sleep_sync",
                claim_scope: "room_shared_claim",
              },
            ],
          },
        ],
      },
      error: null,
      refetch: vi.fn(),
    });

    useRunStudentsAcrossSegmentsQueryMock.mockReturnValue({
      students: [
        {
          admission_number: "MR010",
          full_name: "Student Ten",
          room_id: "A-201",
          roommate_ids: ["MR011"],
          satisfaction_score: 0.35,
          satisfaction_label: "Poor",
          is_at_risk: true,
          reasons: ["Mismatch"],
          factor_trace: [],
        },
        {
          admission_number: "MR002",
          full_name: "Student Two",
          room_id: "A-202",
          roommate_ids: ["MR001"],
          satisfaction_score: 0.82,
          satisfaction_label: "Excellent",
          is_at_risk: false,
          reasons: ["Strong match"],
          factor_trace: [],
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetchAll: vi.fn(),
    });
  });

  function renderStudentRoute(initialEntry: string) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route
              path="/admin/matching-runs/:runId/students"
              element={
                <>
                  <StudentResultsPage />
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it("opens direct deep link with prefiltered at-risk student and panel selection", () => {
    renderStudentRoute(
      "/admin/matching-runs/run-200/students?segment=M_1st_year_AC_2&label=Poor&atRisk=1&student=MR010",
    );

    expect(screen.getByText("MR010")).toBeInTheDocument();
    expect(screen.queryByText("MR002")).not.toBeInTheDocument();
    expect(screen.getByText(/Student Ten \(MR010\)/)).toBeInTheDocument();
  });

  it("normalizes invalid query values on load", async () => {
    renderStudentRoute(
      "/admin/matching-runs/run-200/students?segment=BAD_SEG&label=Invalid&atRisk=7",
    );

    await waitFor(() => {
      expect(screen.getByTestId("location-probe").textContent).toContain(
        "segment=all&label=all&atRisk=0",
      );
    });
  });

  it("renders stable ordering for identical unsorted data", () => {
    renderStudentRoute(
      "/admin/matching-runs/run-200/students?segment=all&label=all&atRisk=0",
    );

    const rows = screen.getAllByTestId(/student-row-/);
    expect(rows[0]).toHaveAttribute("data-testid", "student-row-MR002");
    expect(rows[1]).toHaveAttribute("data-testid", "student-row-MR010");
  });
});
