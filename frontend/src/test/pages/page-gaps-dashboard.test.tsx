import { fireEvent, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { AdminDashboard } from "../../pages/AdminDashboard";
import { renderWithProviders } from "../renderWithProviders";

const { useWorkspaceDashboardQueryMock, magicFillWorkspaceMock, toastMock } = vi.hoisted(
  () => ({
    useWorkspaceDashboardQueryMock: vi.fn(),
    magicFillWorkspaceMock: vi.fn(),
    toastMock: vi.fn(),
  }),
);

vi.mock("../../hooks/useWorkspacesQuery", () => ({
  useWorkspaceDashboardQuery: useWorkspaceDashboardQueryMock,
}));

vi.mock("../../lib/apiClient", () => ({
  magicFillWorkspace: magicFillWorkspaceMock,
}));

vi.mock("../../hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

const refetchMock = vi.fn();

function dashboardData(overrides: {
  roster?: boolean;
  rooms?: boolean;
  collection?: boolean;
  total?: number;
  valid?: number;
  percentage?: number;
  totalSegments?: number;
  ready?: number;
  impossible?: number;
  atRisk?: number;
  runId?: string | null;
  runStatus?: string | null;
  runCreatedAt?: string | null;
  generated?: boolean;
}) {
  return {
    workspace: { id: "ws_test", name: "Test Workspace" },
    setup_status: {
      master_students_uploaded: overrides.roster ?? true,
      rooms_uploaded: overrides.rooms ?? true,
      forms_collection_started: overrides.collection ?? true,
      at_least_one_segment_ready: (overrides.ready ?? 1) > 0,
    },
    form_collection_stats: {
      total_students: overrides.total ?? 8,
      students_with_valid_preferences: overrides.valid ?? 8,
      percentage_complete: overrides.percentage ?? 100,
    },
    segments_status: {
      total_segments: overrides.totalSegments ?? 2,
      ready: overrides.ready ?? 2,
      impossible: overrides.impossible ?? 0,
      at_risk: overrides.atRisk ?? 0,
    },
    latest_matching_run: {
      run_id: overrides.runId ?? null,
      status: overrides.runStatus ?? null,
      created_at: overrides.runCreatedAt ?? null,
    },
    generated_data_warning: {
      generated_profiles_count: overrides.generated ? 4 : 0,
      has_generated_data: overrides.generated ?? false,
    },
  };
}

function showDashboard(
  data: ReturnType<typeof dashboardData> | undefined,
  overrides: Record<string, unknown> = {},
) {
  useWorkspaceDashboardQueryMock.mockReturnValue({
    isLoading: false,
    isError: false,
    data,
    error: null,
    refetch: refetchMock,
    ...overrides,
  });
}

describe("AdminDashboard states", () => {
  beforeEach(() => {
    refetchMock.mockReset();
    magicFillWorkspaceMock.mockReset();
    toastMock.mockReset();
  });

  it("shows the reading state before the workspace arrives", () => {
    useWorkspaceDashboardQueryMock.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
      error: null,
      refetch: refetchMock,
    });

    renderWithProviders(<AdminDashboard />);

    expect(screen.getByText("Reading the workspace")).toBeInTheDocument();
    expect(screen.getByText("reading the workspace")).toBeInTheDocument();
  });

  it("reports an unreadable workspace and retries", () => {
    useWorkspaceDashboardQueryMock.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      error: new Error("dashboard failed"),
      refetch: refetchMock,
    });

    renderWithProviders(<AdminDashboard />);

    expect(screen.getByText("The workspace could not be read")).toBeInTheDocument();
    expect(screen.getByText("dashboard failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  it("starts a fresh workspace at the roster upload", () => {
    showDashboard(
      dashboardData({
        roster: false,
        rooms: false,
        collection: false,
        total: 0,
        valid: 0,
        percentage: 0,
        totalSegments: 0,
        ready: 0,
      }),
    );

    renderWithProviders(<AdminDashboard />);

    expect(screen.getByText(/No student roster yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upload the students file/i })).toHaveAttribute(
      "href",
      "/app/ws_test/students-data",
    );
    expect(screen.getByText("No run recorded yet")).toBeInTheDocument();
    expect(screen.getByText("No students yet")).toBeInTheDocument();
    expect(screen.getByText("No rooms yet")).toBeInTheDocument();
    expect(screen.getByText("0 of 0 answered")).toBeInTheDocument();

    expect(screen.getByText("First run")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Upload the students CSV/ })).toHaveAttribute(
      "href",
      "/app/ws_test/students-data",
    );
    expect(screen.getByRole("link", { name: /Upload the rooms CSV/ })).toHaveAttribute(
      "href",
      "/app/ws_test/students-data",
    );
    expect(screen.getByRole("link", { name: /Collect preferences/ })).toHaveAttribute(
      "href",
      "/app/ws_test/form-collection",
    );
    expect(screen.getByRole("link", { name: /Run matching/ })).toHaveAttribute(
      "href",
      "/app/ws_test/matching-runs",
    );
    expect(screen.getByRole("link", { name: /Read results and export/ })).toHaveAttribute(
      "href",
      "/app/ws_test/matching-runs",
    );
    expect(screen.getByText(/Use fake data, not real student data/)).toBeInTheDocument();
  });

  it("asks for the room list once the roster is in", () => {
    showDashboard(dashboardData({ rooms: false, collection: false, ready: 0, totalSegments: 0 }));

    renderWithProviders(<AdminDashboard />);

    expect(screen.getByRole("link", { name: /add the room list/i })).toHaveAttribute(
      "href",
      "/app/ws_test/students-data",
    );
    expect(screen.getByText("Students uploaded")).toBeInTheDocument();
  });

  it("asks for the form link once rooms and students exist", () => {
    showDashboard(
      dashboardData({ collection: false, ready: 0, totalSegments: 0, total: 4, valid: 0 }),
    );

    renderWithProviders(<AdminDashboard />);

    expect(screen.getByRole("link", { name: "Share the form" })).toHaveAttribute(
      "href",
      "/app/ws_test/form-collection",
    );
    expect(screen.getByText("0 of 4 answered")).toBeInTheDocument();
  });

  it("reads a completed proposal and lists the generated-data warning", () => {
    showDashboard(
      dashboardData({
        runId: "run-777",
        runStatus: "completed",
        generated: true,
      }),
    );

    renderWithProviders(<AdminDashboard />);

    expect(
      screen.getByRole("link", { name: /read the proposal/i }),
    ).toHaveAttribute("href", "/app/ws_test/matching-runs/run-777/rooms");
    expect(screen.getByText("Generated data present")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Students Each student's room/ })).toHaveAttribute(
      "href",
      "/app/ws_test/matching-runs/run-777/students?segment=all&label=all&atRisk=0",
    );
    expect(screen.getByRole("link", { name: /^Fairness The floor/ })).toHaveAttribute(
      "href",
      "/app/ws_test/fairness/run-777?segment=all",
    );
    expect(screen.getByText("2/2")).toBeInTheDocument();
    expect(screen.queryByText("First run")).not.toBeInTheDocument();
  });

  it("opens a run that has not completed yet", () => {
    showDashboard(
      dashboardData({
        runId: "run-778",
        runStatus: "running",
        ready: 2,
      }),
    );

    renderWithProviders(<AdminDashboard />);

    expect(
      screen.getByRole("link", { name: /open the latest run/i }),
    ).toHaveAttribute("href", "/app/ws_test/matching-runs");
    expect(screen.getByText(/The latest run is running/i)).toBeInTheDocument();
  });

  it("sends a capacity gap to the room list when nothing can run", () => {
    showDashboard(
      dashboardData({ ready: 0, impossible: 2, atRisk: 0, total: 6, valid: 6 }),
    );

    renderWithProviders(<AdminDashboard />);

    expect(screen.getByRole("link", { name: /fix the room list/i })).toHaveAttribute(
      "href",
      "/app/ws_test/students-data",
    );
    expect(screen.getByText(/2 segments have more students than beds/i)).toBeInTheDocument();
    expect(screen.getByText("Impossible")).toBeInTheDocument();
  });

  it("keeps both blockers with their own actions under a ready run", () => {
    showDashboard(
      dashboardData({
        ready: 1,
        impossible: 1,
        atRisk: 1,
        total: 10,
        valid: 6,
      }),
    );

    renderWithProviders(<AdminDashboard />);

    expect(screen.getByText(/1 segment cannot be matched/i)).toBeInTheDocument();
    expect(screen.getByText(/1 segment is at risk/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /chase 4 responses/i })).toHaveAttribute(
      "href",
      "/app/ws_test/form-collection",
    );
    expect(screen.getByRole("link", { name: /fix the room list/i })).toHaveAttribute(
      "href",
      "/app/ws_test/students-data",
    );
  });

  it("explains that no segments exist yet", () => {
    showDashboard(dashboardData({ ready: 0, totalSegments: 0, total: 0, valid: 0 }));

    renderWithProviders(<AdminDashboard />);

    expect(screen.getByRole("link", { name: /check the roster file/i })).toHaveAttribute(
      "href",
      "/app/ws_test/students-data",
    );
    expect(screen.getByText("Missing")).toBeInTheDocument();
  });

  it("falls back to opening matching runs when nothing else blocks", () => {
    showDashboard(
      dashboardData({ ready: 0, totalSegments: 2, impossible: 0, atRisk: 0, total: 8, valid: 8 }),
    );

    renderWithProviders(<AdminDashboard />);

    expect(screen.getByText(/No segment is ready to run yet/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /matching runs/i }).length,
    ).toBeGreaterThan(0);
  });

  it("renders an em dash when completion is not a number and a raw date when it is unparseable", () => {
    const data = dashboardData({
      runId: "run-900",
      runStatus: "completed",
      runCreatedAt: "the day before",
    });
    showDashboard({
      ...data,
      form_collection_stats: {
        ...data.form_collection_stats,
        percentage_complete: Number.NaN,
      },
    });

    renderWithProviders(<AdminDashboard />);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("the day before")).toBeInTheDocument();
    expect(screen.queryByText("No run recorded yet")).not.toBeInTheDocument();
  });

  it("fills missing profiles for the whole workspace and refreshes", async () => {
    magicFillWorkspaceMock.mockResolvedValue({ profiles_created: 12 });
    showDashboard(dashboardData({ runId: "run-1", runStatus: "completed" }));

    renderWithProviders(<AdminDashboard />);

    fireEvent.click(screen.getByRole("button", { name: /fill missing profiles/i }));

    await waitFor(() =>
      expect(magicFillWorkspaceMock).toHaveBeenCalledWith("ws_test", null),
    );
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith({
        title: "Magic Fill complete",
        description: expect.stringContaining("12"),
      }),
    );
    expect(refetchMock).toHaveBeenCalled();
  });

  it("reports a failed Magic Fill without refreshing", async () => {
    magicFillWorkspaceMock.mockRejectedValue(new Error("roster locked"));
    showDashboard(dashboardData({}));

    renderWithProviders(<AdminDashboard />);

    fireEvent.click(screen.getByRole("button", { name: /fill missing profiles/i }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith({
        variant: "destructive",
        title: "Magic Fill failed",
        description: "roster locked",
      }),
    );
    expect(refetchMock).not.toHaveBeenCalled();
  });
});
