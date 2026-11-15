import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";

import { PlatformTenantsPage } from "../../pages/platform/PlatformTenantsPage";
import { PlatformTenantWorkspacesPage } from "../../pages/platform/PlatformTenantWorkspacesPage";

const {
  getPlatformTenantsMock,
  getPlatformTenantMock,
  getPlatformTenantWorkspacesMock,
  impersonateTenantMock,
  setApiTokenMock,
  toastMock,
  useAuthMock,
} = vi.hoisted(() => ({
  getPlatformTenantsMock: vi.fn(),
  getPlatformTenantMock: vi.fn(),
  getPlatformTenantWorkspacesMock: vi.fn(),
  impersonateTenantMock: vi.fn(),
  setApiTokenMock: vi.fn(),
  toastMock: vi.fn(),
  useAuthMock: vi.fn(),
}));

vi.mock("../../lib/apiClient", () => ({
  getPlatformTenants: getPlatformTenantsMock,
  getPlatformTenant: getPlatformTenantMock,
  getPlatformTenantWorkspaces: getPlatformTenantWorkspacesMock,
  impersonateTenant: impersonateTenantMock,
  setApiToken: setApiTokenMock,
}));

vi.mock("../../hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: useAuthMock,
}));

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

function renderTenants() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={["/platform"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/platform"
            element={
              <>
                <PlatformTenantsPage />
                <LocationProbe />
              </>
            }
          />
          <Route path="/platform/tenants/:tenantId/workspaces" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderWorkspaces() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={["/platform/tenants/tenant-alpha/workspaces"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/platform/tenants/:tenantId/workspaces"
            element={<PlatformTenantWorkspacesPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const TENANTS = {
  total: 2,
  tenants: [
    {
      id: "tenant-alpha",
      slug: "alpha-institute",
      display_name: "Alpha Institute",
      contact_email: "office@alpha.example",
      is_demo: false,
      demo_expires_at: null,
      created_at: "2026-01-12T09:00:00Z",
      workspace_count: 3,
    },
    {
      id: "tenant-demo",
      slug: "demo-sandbox",
      display_name: "Demo Sandbox",
      contact_email: null,
      is_demo: true,
      demo_expires_at: "2026-02-12T09:00:00Z",
      created_at: "not-a-date",
      workspace_count: 1,
    },
  ],
};

describe("PlatformTenantsPage", () => {
  beforeEach(() => {
    getPlatformTenantsMock.mockReset();
    useAuthMock.mockReset();
    useAuthMock.mockReturnValue({ token: null, user: null, isLoading: false });
  });

  it("shows the loading state while tenants are being read", () => {
    getPlatformTenantsMock.mockReturnValue(new Promise(() => {}));

    renderTenants();

    expect(screen.getByText("Reading tenants")).toBeInTheDocument();
    expect(screen.getByText("All tenants")).toBeInTheDocument();
  });

  it("reports a read failure with the server message", async () => {
    getPlatformTenantsMock.mockRejectedValue(new Error("tenant service down"));

    renderTenants();

    expect(await screen.findByText("Tenants could not be read")).toBeInTheDocument();
    expect(screen.getByText("tenant service down")).toBeInTheDocument();
  });

  it("lists tenants, filters by name or slug, and opens a tenant workspace list", async () => {
    getPlatformTenantsMock.mockResolvedValue(TENANTS);

    renderTenants();

    expect(await screen.findByText("Alpha Institute")).toBeInTheDocument();
    expect(screen.getByText("alpha-institute")).toBeInTheDocument();
    expect(screen.getByText("office@alpha.example")).toBeInTheDocument();
    expect(screen.getByText("No contact recorded")).toBeInTheDocument();
    expect(screen.getByText("Real")).toBeInTheDocument();
    expect(screen.getByText("Demo")).toBeInTheDocument();
    expect(screen.getByText("not-a-date")).toBeInTheDocument();
    expect(screen.getByText("2 tenants")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Name or slug"), {
      target: { value: "alpha" },
    });

    expect(screen.getByText("Alpha Institute")).toBeInTheDocument();
    expect(screen.queryByText("Demo Sandbox")).not.toBeInTheDocument();
    expect(screen.getByText("1 tenant")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Name or slug"), {
      target: { value: "nothing-matches" },
    });
    expect(screen.getByText("No tenant matches that filter")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Name or slug"), {
      target: { value: "" },
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Workspaces" })[0]);
    expect(screen.getByTestId("location").textContent).toBe(
      "/platform/tenants/tenant-alpha/workspaces",
    );
  });

  it("explains an empty platform and re-reads when demo tenants are included", async () => {
    getPlatformTenantsMock.mockResolvedValue({ total: 0, tenants: [] });

    renderTenants();

    expect(await screen.findByText("No tenants on this platform yet")).toBeInTheDocument();
    expect(getPlatformTenantsMock).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByLabelText(/include demo tenants/i));

    await waitFor(() => expect(getPlatformTenantsMock).toHaveBeenCalledWith(true));
  });
});

const WORKSPACES = {
  tenant_id: "tenant-alpha",
  workspaces: [
    {
      id: "ws-alpha-1",
      name: "Main Hostel Desk",
      status: "active",
      source: "institute",
      is_demo_seeded: false,
      created_at: "2026-01-12T09:00:00Z",
    },
    {
      id: "ws-alpha-2",
      name: "Demo Rehearsal",
      status: "active",
      source: "demo",
      is_demo_seeded: true,
      created_at: "2026-01-13T09:00:00Z",
    },
  ],
};

describe("PlatformTenantWorkspacesPage", () => {
  beforeEach(() => {
    getPlatformTenantMock.mockReset();
    getPlatformTenantWorkspacesMock.mockReset();
    impersonateTenantMock.mockReset();
    setApiTokenMock.mockReset();
    toastMock.mockReset();
    sessionStorage.clear();
    useAuthMock.mockReturnValue({ token: "real-admin-token", user: null, isLoading: false });
  });

  it("shows the loading state while the tenant's workspaces are read", () => {
    getPlatformTenantMock.mockReturnValue(new Promise(() => {}));
    getPlatformTenantWorkspacesMock.mockReturnValue(new Promise(() => {}));

    renderWorkspaces();

    expect(screen.getByText("Reading workspaces")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Tenant workspaces" })).toBeInTheDocument();
  });

  it("reports a workspace read failure", async () => {
    getPlatformTenantMock.mockRejectedValue(new Error("tenant not found"));
    getPlatformTenantWorkspacesMock.mockRejectedValue(new Error("workspaces unavailable"));

    renderWorkspaces();

    expect(await screen.findByText("Workspaces could not be read")).toBeInTheDocument();
    expect(screen.getByText("workspaces unavailable")).toBeInTheDocument();
  });

  it("lists workspaces with their demo flag and tenant name", async () => {
    getPlatformTenantMock.mockResolvedValue(TENANTS.tenants[0]);
    getPlatformTenantWorkspacesMock.mockResolvedValue(WORKSPACES);

    renderWorkspaces();

    expect(await screen.findByRole("heading", { level: 1, name: "Alpha Institute" })).toBeInTheDocument();
    expect(screen.getByText("Main Hostel Desk")).toBeInTheDocument();
    expect(screen.getByText("Demo Rehearsal")).toBeInTheDocument();
    expect(screen.getByText("Demo seeded")).toBeInTheDocument();
    expect(screen.getByText("ws-alpha-1")).toBeInTheDocument();
  });

  it("explains an empty tenant", async () => {
    getPlatformTenantMock.mockResolvedValue(TENANTS.tenants[0]);
    getPlatformTenantWorkspacesMock.mockResolvedValue({
      tenant_id: "tenant-alpha",
      workspaces: [],
    });

    renderWorkspaces();

    expect(await screen.findByText("This tenant has no workspaces")).toBeInTheDocument();
  });

  it("enters a workspace by storing the impersonation token", async () => {
    getPlatformTenantMock.mockResolvedValue(TENANTS.tenants[0]);
    getPlatformTenantWorkspacesMock.mockResolvedValue(WORKSPACES);
    impersonateTenantMock.mockResolvedValue({
      token: "impersonation-token",
      tenant_id: "tenant-alpha",
      workspace_id: "ws-alpha-1",
      expires_in_hours: 2,
    });

    renderWorkspaces();

    fireEvent.click(
      (await screen.findAllByRole("button", { name: /enter as this workspace/i }))[0],
    );

    await waitFor(() =>
      expect(impersonateTenantMock).toHaveBeenCalledWith("tenant-alpha", "ws-alpha-1"),
    );
    await waitFor(() =>
      expect(sessionStorage.getItem("impersonation_token")).toBe("impersonation-token"),
    );
    expect(sessionStorage.getItem("real_admin_token")).toBe("real-admin-token");
    expect(setApiTokenMock).toHaveBeenCalledWith("impersonation-token");
  });

  it("disables the entry button while the impersonation request is in flight", async () => {
    getPlatformTenantMock.mockResolvedValue(TENANTS.tenants[0]);
    getPlatformTenantWorkspacesMock.mockResolvedValue(WORKSPACES);
    impersonateTenantMock.mockReturnValue(new Promise(() => {}));

    renderWorkspaces();

    fireEvent.click(
      (await screen.findAllByRole("button", { name: /enter as this workspace/i }))[0],
    );

    expect((await screen.findAllByRole("button", { name: "Entering…" }))[0]).toBeDisabled();
  });

  it("reports an impersonation failure with a toast and an inline alert", async () => {
    getPlatformTenantMock.mockResolvedValue(TENANTS.tenants[0]);
    getPlatformTenantWorkspacesMock.mockResolvedValue(WORKSPACES);
    impersonateTenantMock.mockRejectedValue(new Error("not allowed to impersonate"));

    renderWorkspaces();

    fireEvent.click(
      (await screen.findAllByRole("button", { name: /enter as this workspace/i }))[0],
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("not allowed to impersonate");
    expect(toastMock).toHaveBeenCalledWith({
      title: "Impersonation failed",
      description: "not allowed to impersonate",
      variant: "destructive",
    });
    expect(sessionStorage.getItem("impersonation_token")).toBeNull();
  });
});

afterEach(() => {
  act(() => {
    sessionStorage.clear();
  });
});
