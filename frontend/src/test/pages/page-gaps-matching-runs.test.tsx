import { fireEvent, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { AdminMatchingRuns } from "../../pages/AdminMatchingRuns";
import { renderWithProviders } from "../renderWithProviders";

const {
  useAdminSegmentsQueryMock,
  useAdminMatchingRunsQueryMock,
  useRunMatchingMutationMock,
  magicFillWorkspaceMock,
  toastMock,
} = vi.hoisted(() => ({
  useAdminSegmentsQueryMock: vi.fn(),
  useAdminMatchingRunsQueryMock: vi.fn(),
  useRunMatchingMutationMock: vi.fn(),
  magicFillWorkspaceMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("../../hooks/useAdminSegments", () => ({
  useAdminSegmentsQuery: useAdminSegmentsQueryMock,
}));

vi.mock("../../hooks/useAdminMatchingRuns", () => ({
  useAdminMatchingRunsQuery: useAdminMatchingRunsQueryMock,
  useRunMatchingMutation: useRunMatchingMutationMock,
}));

vi.mock("../../lib/apiClient", () => ({
  magicFillWorkspace: magicFillWorkspaceMock,
}));

vi.mock("../../hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

const mutateAsyncMock = vi.fn();
const refetchSegmentsMock = vi.fn();
const refetchRunsMock = vi.fn();

const READY_SEGMENT = {
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
};

const INCOMPLETE_SEGMENT = {
  segment_key: "F_2nd_year_NonAC_3",
  gender: "F",
  year_group: "2nd_year",
  ac_type: "NonAC",
  room_size: 3,
  status: "Incomplete",
  student_count: 12,
  total_capacity: 9,
  missing_preferences_count: 5,
  missing_preferences_ratio: 0.42,
};

const COMPLETED_RUN = {
  run_id: "run-100",
  created_at: "2026-03-30T10:00:00Z",
  started_at: "2026-03-30T10:00:03Z",
  finished_at: "2026-03-30T10:00:10Z",
  status: "completed",
  scope: "all_ready_segments",
  segments_completed: 2,
  error_message: null,
};

const RUNNING_RUN = {
  run_id: "run-101",
  created_at: "2026-03-31T10:00:00Z",
  started_at: "2026-03-31T10:00:03Z",
  finished_at: null,
  status: "running",
  scope: "segment",
  segments_completed: 0,
  error_message: null,
};

function segmentsQuery(overrides: Record<string, unknown> = {}) {
  return {
    isLoading: false,
    isError: false,
    isSuccess: true,
    data: { segments: [READY_SEGMENT, INCOMPLETE_SEGMENT] },
    error: null,
    refetch: refetchSegmentsMock,
    ...overrides,
  };
}

function runsQuery(overrides: Record<string, unknown> = {}) {
  return {
    isLoading: false,
    isError: false,
    isSuccess: true,
    data: { runs: [COMPLETED_RUN, RUNNING_RUN] },
    error: null,
    refetch: refetchRunsMock,
    ...overrides,
  };
}

function runMutation(overrides: Record<string, unknown> = {}) {
  return {
    mutateAsync: mutateAsyncMock,
    isPending: false,
    isSuccess: false,
    isError: false,
    data: null,
    error: null,
    ...overrides,
  };
}

describe("AdminMatchingRuns states and actions", () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockResolvedValue({ run_id: "run-200" });
    refetchSegmentsMock.mockReset();
    refetchRunsMock.mockReset();
    magicFillWorkspaceMock.mockReset();
    toastMock.mockReset();

    useAdminSegmentsQueryMock.mockReturnValue(segmentsQuery());
    useAdminMatchingRunsQueryMock.mockReturnValue(runsQuery());
    useRunMatchingMutationMock.mockReturnValue(runMutation());
  });

  it("shows both loading notes while the matching data arrives", () => {
    useAdminSegmentsQueryMock.mockReturnValue(
      segmentsQuery({ isLoading: true, isSuccess: false, data: undefined }),
    );
    useAdminMatchingRunsQueryMock.mockReturnValue(
      runsQuery({ isLoading: true, isSuccess: false, data: undefined }),
    );

    renderWithProviders(<AdminMatchingRuns />);

    expect(screen.getByText("Reading segments")).toBeInTheDocument();
    expect(screen.getByText("Reading run history")).toBeInTheDocument();
  });

  it("explains the empty workspace and keeps the run action disabled", () => {
    useAdminSegmentsQueryMock.mockReturnValue(segmentsQuery({ data: { segments: [] } }));
    useAdminMatchingRunsQueryMock.mockReturnValue(runsQuery({ data: { runs: [] } }));

    renderWithProviders(<AdminMatchingRuns />);

    expect(screen.getByText("No segments yet")).toBeInTheDocument();
    expect(screen.getByText("No runs recorded")).toBeInTheDocument();
    expect(screen.getByText("Nothing is ready to match yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run all ready segments/i })).toBeDisabled();
    expect(screen.getByRole("link", { name: /upload the roster/i })).toHaveAttribute(
      "href",
      "/app/ws_test/students-data",
    );
  });

  it("reports unavailable matching data and retries both reads", () => {
    useAdminSegmentsQueryMock.mockReturnValue(
      segmentsQuery({ isError: true, isSuccess: false, data: undefined, error: new Error("segments failed") }),
    );
    useAdminMatchingRunsQueryMock.mockReturnValue(
      runsQuery({ isError: true, isSuccess: false, data: undefined, error: new Error("runs failed") }),
    );

    renderWithProviders(<AdminMatchingRuns />);

    expect(screen.getByText("Matching data is unavailable")).toBeInTheDocument();
    expect(screen.getByText("segments failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(refetchSegmentsMock).toHaveBeenCalledTimes(1);
    expect(refetchRunsMock).toHaveBeenCalledTimes(1);
  });

  it("runs a single ready segment and skips an incomplete one", () => {
    useAdminMatchingRunsQueryMock.mockReturnValue(
      runsQuery({ data: { runs: [COMPLETED_RUN] } }),
    );

    renderWithProviders(<AdminMatchingRuns />);

    const runButtons = screen.getAllByRole("button", { name: /run segment/i });
    expect(runButtons[0]).toBeEnabled();
    expect(runButtons[1]).toBeDisabled();

    fireEvent.click(runButtons[0]);

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      scope: "segment",
      segment_key: "M_1st_year_AC_2",
    });
  });

  it("disables every run action while a run is in progress", () => {
    renderWithProviders(<AdminMatchingRuns />);

    for (const button of screen.getAllByRole("button", { name: /run segment/i })) {
      expect(button).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: /run all ready segments/i })).toBeDisabled();
  });

  it("announces a started run without opening results", () => {
    useRunMatchingMutationMock.mockReturnValue(
      runMutation({
        isSuccess: true,
        data: { run_id: "run-200", status: "running" },
      }),
    );

    renderWithProviders(<AdminMatchingRuns />);

    expect(screen.getByText("Matching run started")).toBeInTheDocument();
    expect(screen.getByText("Results appear here when it finishes.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open the rooms/i })).not.toBeInTheDocument();
  });

  it("confirms a finished run and links to its rooms with the first segment selected", () => {
    useRunMatchingMutationMock.mockReturnValue(
      runMutation({
        isSuccess: true,
        data: { run_id: "run-200", status: "completed" },
      }),
    );

    renderWithProviders(<AdminMatchingRuns />);

    expect(screen.getByText("Matching run completed")).toBeInTheDocument();
    expect(screen.getByText(/Run run-200 finished with status completed/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open the rooms/i })).toHaveAttribute(
      "href",
      "/app/ws_test/matching-runs/run-200/rooms?segment=M_1st_year_AC_2",
    );
  });

  it("reports a failed run with the server message", () => {
    useRunMatchingMutationMock.mockReturnValue(
      runMutation({ isError: true, error: new Error("no ready segments") }),
    );

    renderWithProviders(<AdminMatchingRuns />);

    expect(screen.getByText("The run did not complete")).toBeInTheDocument();
    expect(screen.getByText("no ready segments")).toBeInTheDocument();
  });

  it("offers room, student and fairness links only for completed runs", () => {
    renderWithProviders(<AdminMatchingRuns />);

    expect(screen.getByRole("link", { name: "Rooms" })).toHaveAttribute(
      "href",
      "/app/ws_test/matching-runs/run-100/rooms?segment=M_1st_year_AC_2&needsReview=0",
    );
    expect(screen.getByRole("link", { name: "Students" })).toHaveAttribute(
      "href",
      "/app/ws_test/matching-runs/run-100/students?segment=all&label=all&atRisk=0",
    );
    expect(screen.getByRole("link", { name: "Fairness" })).toHaveAttribute(
      "href",
      "/app/ws_test/fairness/run-100?segment=all",
    );
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("fills missing profiles for one segment and refreshes the readiness table", async () => {
    magicFillWorkspaceMock.mockResolvedValue({ profiles_created: 5 });

    renderWithProviders(<AdminMatchingRuns />);

    fireEvent.click(screen.getAllByRole("button", { name: /fill missing/i })[1]);

    await waitFor(() =>
      expect(magicFillWorkspaceMock).toHaveBeenCalledWith("ws_test", "F_2nd_year_NonAC_3"),
    );
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith({
        title: "Magic Fill complete",
        description: expect.stringContaining("5 generated profiles"),
      }),
    );
    expect(refetchSegmentsMock).toHaveBeenCalled();
  });

  it("reports a Magic Fill failure in a destructive toast", async () => {
    magicFillWorkspaceMock.mockRejectedValue(new Error("no roster rows"));

    renderWithProviders(<AdminMatchingRuns />);

    fireEvent.click(screen.getAllByRole("button", { name: /fill missing/i })[1]);

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith({
        variant: "destructive",
        title: "Magic Fill failed",
        description: "no roster rows",
      }),
    );
  });
});
