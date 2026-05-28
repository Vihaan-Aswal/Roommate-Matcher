import { screen } from "@testing-library/react";
import { vi } from "vitest";

import { AdminDashboard } from "../pages/AdminDashboard";
import { renderWithProviders } from "./renderWithProviders";

const { useAdminDashboardQueryMock } = vi.hoisted(() => ({
  useAdminDashboardQueryMock: vi.fn(),
}));

vi.mock("../hooks/useWorkspacesQuery", () => ({
  useWorkspaceDashboardQuery: useAdminDashboardQueryMock,
}));

describe("AdminDashboard", () => {
  beforeEach(() => {
    useAdminDashboardQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        setup_status: {
          master_students_uploaded: true,
          rooms_uploaded: true,
          forms_collection_started: true,
          at_least_one_segment_ready: true,
        },
        form_collection_stats: {
          total_students: 42,
          students_with_valid_preferences: 38,
          percentage_complete: 90.48,
        },
        segments_status: {
          total_segments: 5,
          ready: 3,
          impossible: 1,
          at_risk: 1,
        },
        latest_matching_run: {
          run_id: "run-001",
          status: "completed",
          created_at: "2026-03-25T15:22:00Z",
        },
      },
      error: null,
    });
  });

  it("renders dashboard metrics and latest run summary", () => {
    renderWithProviders(<AdminDashboard />);

    expect(screen.getByText("Test Workspace Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Total Students")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("run-001")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /upload data/i }),
    ).toBeInTheDocument();
  });
});
