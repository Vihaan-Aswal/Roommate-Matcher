import { fireEvent, screen } from "@testing-library/react";
import { vi } from "vitest";

import { AdminMatchingRuns } from "../pages/AdminMatchingRuns";
import { renderWithProviders } from "./renderWithProviders";

const {
  useAdminSegmentsQueryMock,
  useAdminMatchingRunsQueryMock,
  useRunMatchingMutationMock,
} = vi.hoisted(() => ({
  useAdminSegmentsQueryMock: vi.fn(),
  useAdminMatchingRunsQueryMock: vi.fn(),
  useRunMatchingMutationMock: vi.fn(),
}));

const mutateAsyncMock = vi.fn();

vi.mock("../hooks/useAdminSegments", () => ({
  useAdminSegmentsQuery: useAdminSegmentsQueryMock,
}));

vi.mock("../hooks/useAdminMatchingRuns", () => ({
  useAdminMatchingRunsQuery: useAdminMatchingRunsQueryMock,
  useRunMatchingMutation: useRunMatchingMutationMock,
}));

describe("AdminMatchingRuns", () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();

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
            student_count: 20,
            total_capacity: 20,
            missing_preferences_count: 0,
            missing_preferences_ratio: 0,
          },
        ],
      },
      error: null,
    });

    useAdminMatchingRunsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        runs: [
          {
            run_id: "run-100",
            created_at: "2026-03-30T10:00:00Z",
            started_at: "2026-03-30T10:00:03Z",
            finished_at: "2026-03-30T10:00:10Z",
            status: "completed",
            scope: "segment",
            segments_completed: 1,
            error_message: null,
          },
        ],
      },
      error: null,
    });

    useRunMatchingMutationMock.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
      isSuccess: false,
      isError: false,
      data: null,
      error: null,
    });
  });

  it("triggers run all ready segments action", () => {
    renderWithProviders(<AdminMatchingRuns />);

    fireEvent.click(
      screen.getByRole("button", { name: /run all ready segments/i }),
    );

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      scope: "all_ready_segments",
      segment_key: null,
    });
    expect(screen.getByText("run-100")).toBeInTheDocument();
  });
});
