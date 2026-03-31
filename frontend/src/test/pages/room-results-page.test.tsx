import { fireEvent, screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";

import { RoomResultsPage } from "../../pages/matching/RoomResultsPage";
import { renderWithProviders } from "../renderWithProviders";

const {
  useAdminSegmentsQueryMock,
  useRunRoomsQueryMock,
  useAssignmentsExportMutationMock,
} = vi.hoisted(() => ({
  useAdminSegmentsQueryMock: vi.fn(),
  useRunRoomsQueryMock: vi.fn(),
  useAssignmentsExportMutationMock: vi.fn(),
}));

const mutateAsyncMock = vi.fn();

vi.mock("../../hooks/useAdminSegments", () => ({
  useAdminSegmentsQuery: useAdminSegmentsQueryMock,
}));

vi.mock("../../hooks/useRunRoomsQuery", () => ({
  useRunRoomsQuery: useRunRoomsQueryMock,
}));

vi.mock("../../hooks/useAssignmentsExportMutation", () => ({
  useAssignmentsExportMutation: useAssignmentsExportMutationMock,
}));

describe("RoomResultsPage", () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockResolvedValue({
      blob: new Blob(["csv"], { type: "text/csv" }),
      contentType: "text/csv",
      fileName: "assignments_run-100.csv",
    });

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

    useRunRoomsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        rooms: [
          {
            room_id: "A-101",
            room_size: 2,
            assigned_students: [
              {
                admission_number: "MR001",
                full_name: "Student One",
                pair_scores_with_roommates: { MR002: 0.72 },
              },
              {
                admission_number: "MR002",
                full_name: "Student Two",
                pair_scores_with_roommates: { MR001: 0.72 },
              },
            ],
            group_score: 0.72,
            needs_review: false,
          },
          {
            room_id: "A-102",
            room_size: 2,
            assigned_students: [
              {
                admission_number: "MR003",
                full_name: "Student Three",
                pair_scores_with_roommates: { MR004: 0.49 },
              },
              {
                admission_number: "MR004",
                full_name: "Student Four",
                pair_scores_with_roommates: { MR003: 0.49 },
              },
            ],
            group_score: 0.49,
            needs_review: true,
          },
        ],
      },
      error: null,
    });

    useAssignmentsExportMutationMock.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
      isError: false,
      error: null,
    });

    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    global.URL.revokeObjectURL = vi.fn();
  });

  function renderPage(initialEntry = "/admin/matching-runs/run-100/rooms?segment=M_1st_year_AC_2&needsReview=0") {
    renderWithProviders(
      <Routes>
        <Route
          path="/admin/matching-runs/:runId/rooms"
          element={<RoomResultsPage />}
        />
      </Routes>,
      { initialEntries: [initialEntry] },
    );
  }

  it("renders room columns and applies needs review filter", () => {
    renderPage();

    expect(screen.getByText("Room ID")).toBeInTheDocument();
    expect(screen.getByText("A-101")).toBeInTheDocument();
    expect(screen.getByText("A-102")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/needs review only/i));

    expect(screen.queryByText("A-101")).not.toBeInTheDocument();
    expect(screen.getByText("A-102")).toBeInTheDocument();
  });

  it("triggers CSV export with current run and segment", () => {
    mutateAsyncMock.mockRejectedValueOnce(new Error("export failed"));

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      runId: "run-100",
      segmentKey: "M_1st_year_AC_2",
    });
  });
});
