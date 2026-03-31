import { fireEvent, screen } from "@testing-library/react";
import { vi } from "vitest";

import { AdminManualChecker } from "../../pages/AdminManualChecker";
import { renderWithProviders } from "../renderWithProviders";

const {
  useAdminSegmentsQueryMock,
  useSegmentStudentsQueryMock,
  useManualCheckerMutationMock,
} = vi.hoisted(() => ({
  useAdminSegmentsQueryMock: vi.fn(),
  useSegmentStudentsQueryMock: vi.fn(),
  useManualCheckerMutationMock: vi.fn(),
}));

const mutateAsyncMock = vi.fn();

vi.mock("../../hooks/useAdminSegments", () => ({
  useAdminSegmentsQuery: useAdminSegmentsQueryMock,
}));

vi.mock("../../hooks/useSegmentStudentsQuery", () => ({
  useSegmentStudentsQuery: useSegmentStudentsQueryMock,
}));

vi.mock("../../hooks/useManualCheckerMutation", () => ({
  useManualCheckerMutation: useManualCheckerMutationMock,
}));

describe("ManualCheckerPage", () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();

    useAdminSegmentsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        segments: [
          {
            segment_key: "M_1st_year_AC_3",
            gender: "M",
            year_group: "1st_year",
            ac_type: "AC",
            room_size: 3,
            status: "Ready",
            student_count: 30,
            total_capacity: 30,
            missing_preferences_count: 0,
            missing_preferences_ratio: 0,
          },
        ],
      },
      error: null,
    });

    useSegmentStudentsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        segment_key: "M_1st_year_AC_3",
        room_size: 3,
        students: [
          {
            admission_number: "MR001",
            full_name: "Student One",
            has_valid_preferences: true,
            preference_status: "valid",
          },
          {
            admission_number: "MR002",
            full_name: "Student Two",
            has_valid_preferences: true,
            preference_status: "valid",
          },
          {
            admission_number: "MR003",
            full_name: "Student Three",
            has_valid_preferences: true,
            preference_status: "valid",
          },
        ],
      },
      error: null,
    });

    useManualCheckerMutationMock.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
      data: {
        group_score: 0.71,
        group_label: "Good",
        at_risk_students: [],
        students: [
          {
            admission_number: "MR001",
            satisfaction_score: 0.72,
            satisfaction_label: "Good",
            reasons: ["Routine aligns"],
            is_at_risk: false,
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
    });
  });

  function renderPage() {
    renderWithProviders(<AdminManualChecker />, {
      initialEntries: ["/admin/manual-checker?segment=M_1st_year_AC_3"],
    });
  }

  it("shows advisory disclaimer in both selection and result panels", () => {
    renderPage();

    expect(
      screen.getAllByText(
        /Manual Checker is advisory only\. Running this report does not modify saved assignments or matching runs\./i,
      ).length,
    ).toBe(2);
  });

  it("enforces selection validation and submits correct payload", () => {
    renderPage();

    const runButton = screen.getByRole("button", {
      name: /run compatibility report/i,
    });

    expect(runButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/MR001 - Student One/i));
    fireEvent.click(screen.getByLabelText(/MR002 - Student Two/i));

    fireEvent.change(screen.getByLabelText(/Candidate student/i), {
      target: { value: "MR003" },
    });

    expect(runButton).toBeEnabled();
    fireEvent.click(runButton);

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      segment_key: "M_1st_year_AC_3",
      room_size: 3,
      student_ids: ["MR001", "MR002", "MR003"],
    });
  });

  it("renders checker result details", () => {
    renderPage();

    expect(screen.getByText(/Group compatibility score/i)).toBeInTheDocument();
    expect(screen.getByText(/71.0%/)).toBeInTheDocument();
    expect(screen.getByText(/✅ Sleep schedule - Strong Match/i)).toBeInTheDocument();
  });
});
