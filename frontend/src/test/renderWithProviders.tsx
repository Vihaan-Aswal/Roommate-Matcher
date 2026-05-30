import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceContext } from "../providers/WorkspaceProvider";

export function renderWithProviders(
  ui: ReactElement,
  options?: { initialEntries?: string[] },
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const rawEntries = options?.initialEntries ?? ["/app/ws_test"];
  const initialEntries = rawEntries.map((entry) => {
    if (entry.startsWith("/admin/")) {
      return entry.replace("/admin/", "/app/ws_test/");
    }
    if (entry === "/" || entry === "") {
      return "/app/ws_test";
    }
    return entry;
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <WorkspaceContext.Provider
          value={{
            workspaceId: "ws_test",
            workspaceName: "Test Workspace",
            navigateToWorkspace: () => {},
          }}
        >
          {ui}
        </WorkspaceContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
