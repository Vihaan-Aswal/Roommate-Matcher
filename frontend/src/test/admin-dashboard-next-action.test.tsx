import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AdminDashboard } from "../pages/AdminDashboard";
import { WorkspaceContext } from "../providers/WorkspaceProvider";

const { useWorkspaceDashboardQueryMock } = vi.hoisted(() => ({
  useWorkspaceDashboardQueryMock: vi.fn(),
}));

vi.mock("../hooks/useWorkspacesQuery", () => ({
  useWorkspaceDashboardQuery: useWorkspaceDashboardQueryMock,
}));

function dashboardData(overrides: {
  ready?: number;
  atRisk?: number;
  impossible?: number;
  total?: number;
  valid?: number;
}) {
  const total = overrides.total ?? 8;
  const valid = overrides.valid ?? 4;
  return {
    workspace: { id: "ws_test", name: "Test Workspace" },
    setup_status: {
      master_students_uploaded: true,
      rooms_uploaded: true,
      forms_collection_started: true,
      at_least_one_segment_ready: (overrides.ready ?? 1) > 0,
    },
    form_collection_stats: {
      total_students: total,
      students_with_valid_preferences: valid,
      percentage_complete: (valid / total) * 100,
    },
    segments_status: {
      total_segments: 2,
      ready: overrides.ready ?? 1,
      impossible: overrides.impossible ?? 0,
      at_risk: overrides.atRisk ?? 0,
    },
    latest_matching_run: { run_id: null, status: null, created_at: null },
    generated_data_warning: { has_generated_data: false },
  };
}

function renderDashboard(data: ReturnType<typeof dashboardData>) {
  useWorkspaceDashboardQueryMock.mockReturnValue({
    isLoading: false,
    isError: false,
    data,
    error: null,
    refetch: vi.fn(),
  });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/app/ws_test/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <WorkspaceContext.Provider
          value={{ workspaceId: "ws_test", workspaceName: "Test Workspace", navigateToWorkspace: () => {} }}
        >
          <AdminDashboard />
        </WorkspaceContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminDashboard next action", () => {
  it("lets a ready segment lead, and gives the other blocker its own action in the note", () => {
    const { container } = renderDashboard(dashboardData({ ready: 1, atRisk: 1, valid: 4 }));

    const directive = container.querySelector(".desk-directive") as HTMLElement;
    expect(within(directive).getByRole("link", { name: /run matching/i })).toHaveAttribute(
      "href",
      "/app/ws_test/matching-runs",
    );

    const note = container.querySelector(".desk-note") as HTMLElement;
    expect(note).not.toBeNull();
    expect(within(note).getByText(/1 segment is at risk/i)).toBeInTheDocument();
    // Exactly one action in the note, and it points at the responses.
    expect(within(note).getAllByRole("link")).toHaveLength(1);
    expect(within(note).getByRole("link", { name: /chase 4 responses/i })).toHaveAttribute(
      "href",
      "/app/ws_test/form-collection",
    );
  });

  it("sends a capacity gap to the room list and does not repeat it in the note", () => {
    const { container } = renderDashboard(
      dashboardData({ ready: 0, impossible: 1, atRisk: 0, valid: 4 }),
    );

    const directive = container.querySelector(".desk-directive") as HTMLElement;
    expect(within(directive).getByRole("link", { name: /fix the room list/i })).toHaveAttribute(
      "href",
      "/app/ws_test/students-data",
    );
    expect(within(directive).getByText(/more students than beds/i)).toBeInTheDocument();

    // The directive already carries the only blocker: no note, no second action.
    expect(container.querySelector(".desk-note")).toBeNull();
  });

  it("never offers matching runs when nothing can run", () => {
    const { container } = renderDashboard(
      dashboardData({ ready: 0, atRisk: 1, valid: 2, total: 4 }),
    );

    const directive = container.querySelector(".desk-directive") as HTMLElement;
    expect(within(directive).getByRole("link", { name: /chase 2 responses/i })).toHaveAttribute(
      "href",
      "/app/ws_test/form-collection",
    );
    // The only other matching-runs link is the empty "Latest run" state, not an action.
    expect(within(directive).queryAllByRole("link", { name: /matching runs/i })).toHaveLength(0);
    expect(screen.queryByText(/No segment is ready to run yet/i)).not.toBeInTheDocument();
  });
});
