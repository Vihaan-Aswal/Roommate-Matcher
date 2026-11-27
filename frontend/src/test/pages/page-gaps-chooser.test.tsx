import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";

import { WorkspaceChooserPage } from "../../pages/WorkspaceChooserPage";

const {
  useWorkspacesQueryMock,
  useCreateWorkspaceMutationMock,
  useAuthMock,
} = vi.hoisted(() => ({
  useWorkspacesQueryMock: vi.fn(),
  useCreateWorkspaceMutationMock: vi.fn(),
  useAuthMock: vi.fn(),
}));

vi.mock("../../hooks/useWorkspacesQuery", () => ({
  useWorkspacesQuery: useWorkspacesQueryMock,
  useCreateWorkspaceMutation: useCreateWorkspaceMutationMock,
}));

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: useAuthMock,
}));

const mutateAsyncMock = vi.fn();
const signOutMock = vi.fn();
const refetchMock = vi.fn();

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={["/app"]}
    >
      <Routes>
        <Route
          path="/app"
          element={
            <>
              <WorkspaceChooserPage />
              <LocationProbe />
            </>
          }
        />
        <Route path="/app/:workspaceId/dashboard" element={<LocationProbe />} />
        <Route path="/login" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const WORKSPACES = [
  {
    id: "ws-alpha",
    tenant_id: "tenant-alpha",
    name: "Main Hostel Desk",
    status: "active",
    source: "institute",
    is_demo_seeded: false,
    created_at: "2026-01-12T09:00:00Z",
    updated_at: "2026-01-12T09:00:00Z",
  },
  {
    id: "ws-demo",
    tenant_id: "tenant-alpha",
    name: "Demo Rehearsal",
    status: "active",
    source: "demo",
    is_demo_seeded: true,
    created_at: "not-a-date",
    updated_at: "not-a-date",
  },
];

describe("WorkspaceChooserPage", () => {
  beforeEach(() => {
    useWorkspacesQueryMock.mockReset();
    useCreateWorkspaceMutationMock.mockReset();
    useAuthMock.mockReset();
    mutateAsyncMock.mockReset();
    signOutMock.mockReset();
    refetchMock.mockReset();

    useAuthMock.mockReturnValue({
      user: { email: "warden@example.com", isDemo: false },
      token: "token",
      isLoading: false,
      signInWithEmail: vi.fn(),
      startDemoSession: vi.fn(),
      signOut: signOutMock,
    });

    useWorkspacesQueryMock.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: { workspaces: WORKSPACES },
      error: null,
      refetch: refetchMock,
    });

    useCreateWorkspaceMutationMock.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
      isError: false,
      error: null,
    });
  });

  it("shows a loading note while the workspace list is read", () => {
    useWorkspacesQueryMock.mockReturnValue({
      isLoading: true,
      isSuccess: false,
      isError: false,
      data: undefined,
      error: null,
      refetch: refetchMock,
    });

    renderPage();

    expect(screen.getByText("Reading your workspaces")).toBeInTheDocument();
    expect(screen.getByText("warden@example.com")).toBeInTheDocument();
  });

  it("reports a failed workspace list and retries on request", () => {
    useWorkspacesQueryMock.mockReturnValue({
      isLoading: false,
      isSuccess: false,
      isError: true,
      data: undefined,
      error: new Error("workspace list failed"),
      refetch: refetchMock,
    });

    renderPage();

    expect(screen.getByText("Your workspaces could not be loaded")).toBeInTheDocument();
    expect(screen.getByText("workspace list failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  it("lists workspaces and opens one", () => {
    renderPage();

    expect(screen.getByText("Main Hostel Desk")).toBeInTheDocument();
    expect(screen.getByText("Demo Rehearsal")).toBeInTheDocument();
    expect(screen.getByText("Demo")).toBeInTheDocument();

    const rows = screen.getAllByRole("link");
    expect(rows.some((row) => row.getAttribute("href") === "/app/ws-alpha/dashboard")).toBe(true);
  });

  it("offers creation from the empty state and validates the name before submitting", () => {
    useWorkspacesQueryMock.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: { workspaces: [] },
      error: null,
      refetch: refetchMock,
    });

    renderPage();

    expect(screen.getByText("No workspaces yet")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Create New Workspace" })[0]);

    const nameInput = screen.getByLabelText("New workspace name");
    const createButton = screen.getByRole("button", { name: "Create" });
    expect(createButton).toBeDisabled();

    fireEvent.change(nameInput, { target: { value: "   " } });
    expect(createButton).toBeDisabled();

    fireEvent.change(nameInput, { target: { value: "Hostel office 2026" } });
    expect(createButton).toBeEnabled();
  });

  it("creates a workspace and opens its dashboard", async () => {
    mutateAsyncMock.mockResolvedValue({ id: "ws-new" });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Create New Workspace" }));
    fireEvent.change(screen.getByLabelText("New workspace name"), {
      target: { value: "Hostel office 2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({ name: "Hostel office 2026" }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe("/app/ws-new/dashboard"),
    );
  });

  it("stays on the chooser when creation fails, and cancelling closes the form", async () => {
    mutateAsyncMock.mockRejectedValue(new Error("name already taken"));

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Create New Workspace" }));
    fireEvent.change(screen.getByLabelText("New workspace name"), {
      target: { value: "Duplicate desk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("location").textContent).toBe("/app");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("New workspace name")).not.toBeInTheDocument();
    expect(screen.getByText("Main Hostel Desk")).toBeInTheDocument();
  });

  it("reports a create failure with the server message", () => {
    useCreateWorkspaceMutationMock.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
      isError: true,
      error: new Error("name already taken"),
    });

    renderPage();

    expect(screen.getByText("The workspace was not created")).toBeInTheDocument();
    expect(screen.getByText("name already taken")).toBeInTheDocument();
  });

  it("signs out and returns to the login route", async () => {
    signOutMock.mockResolvedValue(undefined);

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/login"));
  });
});
