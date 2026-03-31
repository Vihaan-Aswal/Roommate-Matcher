import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { RoomResultsPage } from "../../pages/matching/RoomResultsPage";
import { StudentResultsPage } from "../../pages/matching/StudentResultsPage";

describe("result route contracts", () => {
  function renderWithRoute(initialEntry: string, path: string, element: JSX.Element) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path={path} element={element} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it("binds runId for room results route", () => {
    renderWithRoute(
      "/admin/matching-runs/run-101/rooms?segment=M_1st_year_AC_2",
      "/admin/matching-runs/:runId/rooms",
      <RoomResultsPage />,
    );

    expect(screen.getByText("Room Results")).toBeInTheDocument();
    expect(
      screen.getByText(/Room-level matching output for run run-101/i),
    ).toBeInTheDocument();
  });

  it("binds runId for student results route", () => {
    renderWithRoute(
      "/admin/matching-runs/run-101/students?segment=all",
      "/admin/matching-runs/:runId/students",
      <StudentResultsPage />,
    );

    expect(screen.getByText("Student Results")).toBeInTheDocument();
    expect(
      screen.getByText(/Student-level matching results for run run-101/i),
    ).toBeInTheDocument();
  });
});
