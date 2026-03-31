import { fireEvent, screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";

import { StudentResultsPage } from "../../pages/matching/StudentResultsPage";
import { renderWithProviders } from "../renderWithProviders";

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

describe("StudentResultsPage", () => {
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
            admission_number: "MR001",
            full_name: "Student One",
            room_id: "A-101",
            roommate_ids: ["MR002"],
            satisfaction_score: 0.84,
            satisfaction_label: "Excellent",
            is_at_risk: false,
            reasons: ["Compatible sleep", "Compatible budget", "Similar routine"],
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
          {
            admission_number: "MR099",
            full_name: "Student Risk",
            room_id: "A-199",
            roommate_ids: ["MR100"],
            satisfaction_score: 0.44,
            satisfaction_label: "Poor",
            is_at_risk: true,
            reasons: ["Frequent mismatches"],
            factor_trace: [
              {
                factor_key: "q3_enc",
                factor_class: "Strong Mismatch",
                reason_bucket: "wake_conflict",
                polarity: "mismatch",
                template_id: "wake_conflict",
                claim_scope: "student_specific_claim",
              },
            ],
          },
        ],
      },
      error: null,
    });

    useRunStudentsAcrossSegmentsQueryMock.mockReturnValue({
      students: [],
      isLoading: false,
      isError: false,
      error: null,
      refetchAll: vi.fn(),
    });
  });

  function renderPage(
    initialEntry =
      "/admin/matching-runs/run-100/students?segment=M_1st_year_AC_2&label=all&atRisk=0",
  ) {
    renderWithProviders(
      <Routes>
        <Route
          path="/admin/matching-runs/:runId/students"
          element={<StudentResultsPage />}
        />
      </Routes>,
      { initialEntries: [initialEntry] },
    );
  }

  it("applies at-risk filter exactly", () => {
    renderPage();

    expect(screen.getByText("MR001")).toBeInTheDocument();
    expect(screen.getByText("MR099")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/at risk only/i));

    expect(screen.queryByText("MR001")).not.toBeInTheDocument();
    expect(screen.getByText("MR099")).toBeInTheDocument();
  });

  it("opens detail panel for selected student row", () => {
    renderPage();

    fireEvent.click(screen.getByText("Student One"));

    expect(screen.getByText("Student summary")).toBeInTheDocument();
    expect(screen.getByText(/Student One \(MR001\)/)).toBeInTheDocument();
  });
});
