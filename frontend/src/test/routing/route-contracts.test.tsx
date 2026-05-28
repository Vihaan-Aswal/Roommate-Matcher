import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";

import { RoomResultsPage } from "../../pages/matching/RoomResultsPage";
import { StudentResultsPage } from "../../pages/matching/StudentResultsPage";
import { WorkspaceContext } from "../../providers/WorkspaceProvider";

const {
  useAdminSegmentsQueryMock,
  useRunRoomsQueryMock,
  useRunStudentsQueryMock,
  useRunStudentsAcrossSegmentsQueryMock,
  useAssignmentsExportMutationMock,
} = vi.hoisted(() => ({
  useAdminSegmentsQueryMock: vi.fn(),
  useRunRoomsQueryMock: vi.fn(),
  useRunStudentsQueryMock: vi.fn(),
  useRunStudentsAcrossSegmentsQueryMock: vi.fn(),
  useAssignmentsExportMutationMock: vi.fn(),
}));

vi.mock("../../hooks/useAdminSegments", () => ({
  useAdminSegmentsQuery: useAdminSegmentsQueryMock,
}));

vi.mock("../../hooks/useRunRoomsQuery", () => ({
  useRunRoomsQuery: useRunRoomsQueryMock,
}));

vi.mock("../../hooks/useRunStudentsQuery", () => ({
  useRunStudentsQuery: useRunStudentsQueryMock,
}));

vi.mock("../../hooks/useRunStudentsAcrossSegmentsQuery", () => ({
  useRunStudentsAcrossSegmentsQuery: useRunStudentsAcrossSegmentsQueryMock,
}));

vi.mock("../../hooks/useAssignmentsExportMutation", () => ({
  useAssignmentsExportMutation: useAssignmentsExportMutationMock,
}));

vi.mock("../../providers/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    workspaceId: "ws_test",
    workspaceName: "Test Workspace",
    navigateToWorkspace: vi.fn(),
  }),
}));

describe("result route contracts", () => {
  beforeEach(() => {
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
            student_count: 10,
            total_capacity: 10,
            missing_preferences_count: 0,
            missing_preferences_ratio: 0,
          },
        ],
      },
      error: null,
    });

    useRunRoomsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rooms: [] },
      error: null,
    });

    useRunStudentsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { students: [] },
      error: null,
    });

    useRunStudentsAcrossSegmentsQueryMock.mockReturnValue({
      students: [],
      isLoading: false,
      isError: false,
      error: null,
      refetchAll: vi.fn(),
    });

    useAssignmentsExportMutationMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    });
  });

  function renderWithRoute(
    initialEntry: string,
    path: string,
    element: JSX.Element,
  ) {
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
