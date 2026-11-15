import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../App";
import { useAuth } from "../providers/AuthProvider";

vi.mock("../providers/AuthProvider", () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../hooks/useWorkspacesQuery", () => ({
  useWorkspacesQuery: vi.fn(() => ({
    data: { workspaces: [{ id: "123e4567-e89b-12d3-a456-426614174000", name: "Test", created_at: "2023-01-01T00:00:00Z" }] },
    isLoading: false,
    isSuccess: true,
    error: null,
  })),
  useCreateWorkspaceMutation: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useWorkspaceDashboardQuery: vi.fn(() => ({
    data: {
      setup_status: {},
      form_collection_stats: {},
      segments_status: {},
      latest_matching_run: {},
    },
    isLoading: false,
    isSuccess: true,
  })),
}));


vi.mock("../hooks/admin/useDashboardSummary", () => ({
  useDashboardSummary: vi.fn(() => ({
    data: {
      setup_status: {},
      form_collection_stats: {},
      segments_status: {},
      latest_matching_run: {},
    },
    isLoading: false,
    error: null,
  })),
}));

describe("Workspace Routing and Guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("test_unauthenticated_redirect_to_login", async () => {
    // Unauthenticated user
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      startDemo: vi.fn(),
    } as any);

    window.history.pushState({}, "Test page", "/app");
    render(<App />);

    // The route is lazy; the guard's redirect resolves after the chunk loads.
    await waitFor(() => expect(window.location.pathname).toBe("/login"));
    expect(screen.queryByText(/Create New Workspace/i)).not.toBeInTheDocument();
  });

  it("test_authenticated_shows_workspace_chooser", async () => {
    // Authenticated user
    vi.mocked(useAuth).mockReturnValue({
      user: {
        auth_kind: "supabase",
        supabase_user_id: "u1",
        email: "test@example.com",
        role: "owner",
        is_demo: false,
      },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      startDemo: vi.fn(),
    } as any);

    window.history.pushState({}, "Test page", "/app");
    render(<App />);

    // Should render WorkspaceChooserPage
    expect(await screen.findByText(/Create New Workspace/i)).toBeInTheDocument();
  });

  it("test_workspace_route_renders_admin_layout", async () => {
    // Authenticated user
    vi.mocked(useAuth).mockReturnValue({
      user: {
        auth_kind: "supabase",
        supabase_user_id: "u1",
        email: "test@example.com",
        role: "owner",
        is_demo: false,
      },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      startDemo: vi.fn(),
    } as any);

    // Provide a mocked workspace to satisfy WorkspaceProvider if needed
    // Assuming the WorkspaceProvider fetches or uses useWorkspacesQuery
    window.history.pushState({}, "Test page", "/app/123e4567-e89b-12d3-a456-426614174000/dashboard");
    render(<App />);

    // AdminDashboard should render
    // We mock useDashboardSummary above, so the dashboard will render.
    expect(await screen.findByText(/Switch workspace/i)).toBeInTheDocument();
  });

  it("test_legacy_admin_redirect", async () => {
    // Authenticated user
    vi.mocked(useAuth).mockReturnValue({
      user: {
        auth_kind: "supabase",
        supabase_user_id: "u1",
        email: "test@example.com",
        role: "owner",
        is_demo: false,
      },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      startDemo: vi.fn(),
    } as any);

    window.history.pushState({}, "Test page", "/admin/dashboard");
    render(<App />);

    // Should redirect to /app
    await waitFor(() => expect(window.location.pathname).toBe("/app"));
  });
});
