import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";

import { RoomResultsPage } from "../../pages/matching/RoomResultsPage";
import { StudentResultsPage } from "../../pages/matching/StudentResultsPage";
import { renderWithProviders } from "../renderWithProviders";

const {
  useAdminSegmentsQueryMock,
  useRunRoomsQueryMock,
  useRunStudentsQueryMock,
  useRunStudentsAllSegmentsQueryMock,
  useAssignmentsExportMutationMock,
} = vi.hoisted(() => ({
  useAdminSegmentsQueryMock: vi.fn(),
  useRunRoomsQueryMock: vi.fn(),
  useRunStudentsQueryMock: vi.fn(),
  useRunStudentsAllSegmentsQueryMock: vi.fn(),
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

vi.mock("../../hooks/useRunStudentsAllSegmentsQuery", () => ({
  useRunStudentsAllSegmentsQuery: useRunStudentsAllSegmentsQueryMock,
}));

vi.mock("../../hooks/useAssignmentsExportMutation", () => ({
  useAssignmentsExportMutation: useAssignmentsExportMutationMock,
}));

vi.mock("@radix-ui/react-select", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  const Dummy = React.forwardRef(({ children }: any, _ref: any) => children || null);
  Dummy.displayName = "Dummy";

  return {
    Root: ({ children, value, onValueChange }: any) => (
      <select
        data-testid="mock-select"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        {children}
      </select>
    ),
    Trigger: Dummy,
    Value: Dummy,
    Content: ({ children }: any) => children,
    Item: ({ children, value }: any) => <option value={value}>{children}</option>,
    ItemText: ({ children }: any) => children,
    ItemIndicator: Dummy,
    Portal: ({ children }: any) => children,
    Viewport: ({ children }: any) => children,
    Group: Dummy,
    Icon: Dummy,
    Separator: Dummy,
    ScrollUpButton: Dummy,
    ScrollDownButton: Dummy,
    Label: Dummy,
  };
});

const exportMock = vi.fn();
const refetchSegmentsMock = vi.fn();
const refetchRoomsMock = vi.fn();
const refetchStudentsMock = vi.fn();
const refetchAllMock = vi.fn();

const SEGMENTS = {
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
    {
      segment_key: "F_2nd_year_NonAC_3",
      gender: "F",
      year_group: "2nd_year",
      ac_type: "NonAC",
      room_size: 3,
      status: "Ready",
      student_count: 6,
      total_capacity: 6,
      missing_preferences_count: 0,
      missing_preferences_ratio: 0,
    },
  ],
};

const ROOMS = {
  run_id: "run-100",
  segment_key: "M_1st_year_AC_2",
  rooms: [
    {
      room_id: "A-101",
      room_size: 2,
      assigned_students: [
        {
          admission_number: "MR001",
          full_name: "Student One",
          pair_scores_with_roommates: { MR002: 0.72 },
        },
        {
          admission_number: "MR002",
          full_name: "Student Two",
          pair_scores_with_roommates: { MR001: 0.72 },
        },
      ],
      group_score: 0.72,
      needs_review: false,
    },
    {
      room_id: "A-102",
      room_size: 2,
      assigned_students: [
        {
          admission_number: "MR003",
          full_name: "Student Three",
          pair_scores_with_roommates: { MR004: 0.49 },
        },
        {
          admission_number: "MR004",
          full_name: "Student Four",
          pair_scores_with_roommates: { MR003: 0.49 },
        },
      ],
      group_score: 0.49,
      needs_review: true,
    },
  ],
};

const STUDENTS = {
  run_id: "run-100",
  segment_key: "M_1st_year_AC_2",
  students: [
    {
      admission_number: "MR001",
      full_name: "Student One",
      room_id: "A-101",
      roommate_ids: ["MR002"],
      satisfaction_score: 0.84,
      satisfaction_label: "Excellent",
      is_at_risk: false,
      reasons: ["Compatible sleep"],
      factor_trace: [],
    },
    {
      admission_number: "MR099",
      full_name: "Student Risk",
      room_id: "A-199",
      roommate_ids: ["MR100"],
      satisfaction_score: 0.44,
      satisfaction_label: "Poor",
      is_at_risk: true,
      reasons: ["Frequent mismatches"],
      factor_trace: [],
    },
  ],
};

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

function segmentsQuery(overrides: Record<string, unknown> = {}) {
  return {
    isLoading: false,
    isError: false,
    data: SEGMENTS,
    error: null,
    refetch: refetchSegmentsMock,
    ...overrides,
  };
}

function roomsQuery(overrides: Record<string, unknown> = {}) {
  return {
    isLoading: false,
    isError: false,
    data: ROOMS,
    error: null,
    refetch: refetchRoomsMock,
    ...overrides,
  };
}

function studentsQuery(overrides: Record<string, unknown> = {}) {
  return {
    isLoading: false,
    isError: false,
    data: STUDENTS,
    error: null,
    refetch: refetchStudentsMock,
    ...overrides,
  };
}

describe("RoomResultsPage states", () => {
  beforeEach(() => {
    refetchSegmentsMock.mockReset();
    refetchRoomsMock.mockReset();
    refetchStudentsMock.mockReset();
    exportMock.mockReset();
    exportMock.mockResolvedValue({
      blob: new Blob(["csv"], { type: "text/csv" }),
      contentType: "text/csv",
      fileName: "assignments_run-100.csv",
    });

    useAdminSegmentsQueryMock.mockReturnValue(segmentsQuery());
    useRunRoomsQueryMock.mockReturnValue(roomsQuery());
    useRunStudentsQueryMock.mockReturnValue(studentsQuery());
    useAssignmentsExportMutationMock.mockReturnValue({
      mutateAsync: exportMock,
      isPending: false,
      isError: false,
      error: null,
    });
  });

  function renderRooms(initialEntry: string) {
    renderWithProviders(
      <Routes>
        <Route
          path="/app/:workspaceId/matching-runs/:runId/rooms"
          element={
            <>
              <RoomResultsPage />
              <LocationProbe />
            </>
          }
        />
        <Route
          path="/app/:workspaceId/matching-runs"
          element={
            <>
              <RoomResultsPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>,
      { initialEntries: [initialEntry] },
    );
  }

  it("asks for a run when the route carries none", () => {
    renderRooms("/app/ws_test/matching-runs");

    expect(screen.getByText("No run selected")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to matching runs/i })).toHaveAttribute(
      "href",
      "/app/ws_test/matching-runs",
    );
  });

  it("selects the first segment by default and counts the register", () => {
    renderRooms("/app/ws_test/matching-runs/run-100/rooms");

    expect(screen.getByText("Room Results")).toBeInTheDocument();
    expect(screen.getByText(/Room-level matching output for run run-100/)).toBeInTheDocument();
    expect(screen.getByText(/2 rooms/)).toBeInTheDocument();
    expect(screen.getByText(/1 need review/)).toBeInTheDocument();
    expect((screen.getByTestId("mock-select") as HTMLSelectElement).value).toBe(
      "M_1st_year_AC_2",
    );
    expect(screen.getByTestId("location").textContent).toContain(
      "segment=M_1st_year_AC_2&needsReview=0",
    );
  });

  it("changes segment through the filter and drops the open student", () => {
    renderRooms(
      "/app/ws_test/matching-runs/run-100/rooms?segment=M_1st_year_AC_2&needsReview=0&student=MR001",
    );

    expect(screen.getByText("Student summary")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("mock-select"), {
      target: { value: "F_2nd_year_NonAC_3" },
    });

    expect(screen.getByTestId("location").textContent).not.toContain("student=MR001");
    expect(screen.getByTestId("location").textContent).toContain("segment=F_2nd_year_NonAC_3");
  });

  it("selects a room and opens a student's detail from the register", () => {
    renderRooms(
      "/app/ws_test/matching-runs/run-100/rooms?segment=M_1st_year_AC_2&needsReview=0",
    );

    fireEvent.click(screen.getAllByRole("button", { name: /select room/i })[0]);
    expect(screen.getByRole("button", { name: "Selected" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Student One" }));

    expect(screen.getByText("Student summary")).toBeInTheDocument();
    expect(screen.getByText(/Opened from room A-101/)).toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).toContain("student=MR001");
  });

  it("closes the detail panel and forgets a student who is not in the run", () => {
    renderRooms(
      "/app/ws_test/matching-runs/run-100/rooms?segment=M_1st_year_AC_2&needsReview=0&student=MR404",
    );

    expect(screen.queryByText("Student summary")).not.toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).not.toContain("student=MR404");
  });

  it("shows the room loading note", () => {
    useRunRoomsQueryMock.mockReturnValue(
      roomsQuery({ isLoading: true, data: undefined }),
    );

    renderRooms("/app/ws_test/matching-runs/run-100/rooms?segment=M_1st_year_AC_2");

    expect(screen.getByText("Reading rooms")).toBeInTheDocument();
  });

  it("reports a segment read failure and retries", () => {
    useAdminSegmentsQueryMock.mockReturnValue(
      segmentsQuery({ isError: true, data: undefined, error: new Error("segments failed") }),
    );

    renderRooms("/app/ws_test/matching-runs/run-100/rooms?segment=M_1st_year_AC_2");

    expect(screen.getByText("Segments are unavailable")).toBeInTheDocument();
    expect(screen.getByText("segments failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetchSegmentsMock).toHaveBeenCalledTimes(1);
  });

  it("reports a room read failure and retries", () => {
    useRunRoomsQueryMock.mockReturnValue(
      roomsQuery({ isError: true, data: undefined, error: new Error("rooms failed") }),
    );

    renderRooms("/app/ws_test/matching-runs/run-100/rooms?segment=M_1st_year_AC_2");

    expect(screen.getByText("Room results could not be read")).toBeInTheDocument();
    expect(screen.getByText("rooms failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetchRoomsMock).toHaveBeenCalledTimes(1);
  });

  it("reports unavailable student details and retries", () => {
    useRunStudentsQueryMock.mockReturnValue(
      studentsQuery({ isError: true, data: undefined, error: new Error("students failed") }),
    );

    renderRooms("/app/ws_test/matching-runs/run-100/rooms?segment=M_1st_year_AC_2");

    expect(screen.getByText("Student details are unavailable")).toBeInTheDocument();
    expect(screen.getByText("students failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetchStudentsMock).toHaveBeenCalledTimes(1);
  });

  it("warns when the results include generated profiles", () => {
    useRunRoomsQueryMock.mockReturnValue(
      roomsQuery({ data: { ...ROOMS, has_generated_profiles: true } }),
    );

    renderRooms("/app/ws_test/matching-runs/run-100/rooms?segment=M_1st_year_AC_2");

    expect(screen.getByText("Generated data present")).toBeInTheDocument();
  });

  it("downloads the assignment CSV for the selected segment", async () => {
    const createObjectURL = vi.fn(() => "blob:export");
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    renderRooms("/app/ws_test/matching-runs/run-100/rooms?segment=M_1st_year_AC_2");

    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));

    await waitFor(() =>
      expect(exportMock).toHaveBeenCalledWith({
        runId: "run-100",
        segmentKey: "M_1st_year_AC_2",
      }),
    );
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:export");

    clickSpy.mockRestore();
  });

  it("trims the CSV to the needs-review filter when one is active", async () => {
    const createObjectURL = vi.fn(() => "blob:export");
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = vi.fn();
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    exportMock.mockResolvedValue({
      blob: new Blob(
        [
          "room_id,segment_key,student_1,student_2,student_3,student_4,group_score\n" +
            "A-101,M_1st_year_AC_2,MR001,MR002,,,0.72\n" +
            "A-102,M_1st_year_AC_2,MR003,MR004,,,0.49\n",
        ],
        { type: "text/csv" },
      ),
      contentType: "text/csv",
      fileName: "assignments_run-100.csv",
    });

    renderRooms(
      "/app/ws_test/matching-runs/run-100/rooms?segment=M_1st_year_AC_2&needsReview=1",
    );

    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const blob = (createObjectURL.mock.calls[0] as unknown[])[0] as Blob;
    const text = await blob.text();
    expect(text).toContain("A-102");
    expect(text).not.toContain("A-101");

    clickSpy.mockRestore();
  });

  it("reports a failed export", () => {
    useAssignmentsExportMutationMock.mockReturnValue({
      mutateAsync: exportMock,
      isPending: false,
      isError: true,
      error: new Error("export failed"),
    });

    renderRooms("/app/ws_test/matching-runs/run-100/rooms?segment=M_1st_year_AC_2");

    expect(screen.getByText("The CSV was not exported")).toBeInTheDocument();
    expect(screen.getByText("export failed")).toBeInTheDocument();
  });
});

describe("StudentResultsPage states", () => {
  beforeEach(() => {
    refetchSegmentsMock.mockReset();
    refetchStudentsMock.mockReset();
    refetchAllMock.mockReset();

    useAdminSegmentsQueryMock.mockReturnValue(segmentsQuery());
    useRunStudentsQueryMock.mockReturnValue(studentsQuery());
    useRunStudentsAllSegmentsQueryMock.mockReturnValue({
      students: [...STUDENTS.students].sort((left, right) =>
        left.admission_number.localeCompare(right.admission_number),
      ),
      isLoading: false,
      isError: false,
      error: null,
      refetchAll: refetchAllMock,
    });
  });

  function renderStudents(initialEntry: string) {
    renderWithProviders(
      <Routes>
        <Route
          path="/app/:workspaceId/matching-runs/:runId/students"
          element={
            <>
              <StudentResultsPage />
              <LocationProbe />
            </>
          }
        />
        <Route
          path="/app/:workspaceId/matching-runs"
          element={
            <>
              <StudentResultsPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>,
      { initialEntries: [initialEntry] },
    );
  }

  it("asks for a run when the route carries none", () => {
    renderStudents("/app/ws_test/matching-runs");

    expect(screen.getByText("No run selected")).toBeInTheDocument();
  });

  it("renders the distribution across all segments and filters by label", () => {
    renderStudents("/app/ws_test/matching-runs/run-100/students?segment=all");

    expect(screen.getByText("Student Results")).toBeInTheDocument();
    expect(screen.getByText(/Distribution in this view/)).toBeInTheDocument();
    expect(screen.getAllByText("Excellent").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 students").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Poor" }));

    expect(screen.getByTestId("location").textContent).toContain("label=Poor");
    expect(screen.getByText("Student Risk")).toBeInTheDocument();
    expect(screen.queryByText("Student One")).not.toBeInTheDocument();
  });

  it("filters to at-risk students and explains an empty at-risk view", () => {
    renderStudents(
      "/app/ws_test/matching-runs/run-100/students?segment=all&atRisk=1&label=all",
    );

    expect(screen.getByText(/Reviewing the students below the floor/)).toBeInTheDocument();
    expect(screen.getByText("Student Risk")).toBeInTheDocument();
    expect(screen.getByText(/1 at risk/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Excellent" }));
    expect(screen.getByTestId("location").textContent).toContain("label=Excellent");
  });

  it("says when no student in an at-risk view is below the floor", () => {
    useRunStudentsAllSegmentsQueryMock.mockReturnValue({
      students: [STUDENTS.students[0]],
      isLoading: false,
      isError: false,
      error: null,
      refetchAll: refetchAllMock,
    });

    renderStudents(
      "/app/ws_test/matching-runs/run-100/students?segment=all&atRisk=1&label=all",
    );

    expect(screen.getByText("No student is below the floor")).toBeInTheDocument();
  });

  it("opens a student's detail from the register and closes it", () => {
    renderStudents("/app/ws_test/matching-runs/run-100/students?segment=all");

    fireEvent.click(screen.getByTestId("student-row-MR099"));

    expect(screen.getByText("Student summary")).toBeInTheDocument();
    expect(screen.getByText(/Student Risk \(MR099\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByText("Student summary")).not.toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).not.toContain("student=");
  });

  it("uses a single segment's students when one is selected", () => {
    renderStudents(
      "/app/ws_test/matching-runs/run-100/students?segment=M_1st_year_AC_2&label=all&atRisk=0",
    );

    expect(screen.getByText("Student One")).toBeInTheDocument();
    expect(screen.getByText("MR099")).toBeInTheDocument();
  });

  it("normalises segment, label and at-risk parameters that are not valid", () => {
    renderStudents(
      "/app/ws_test/matching-runs/run-100/students?segment=not-a-segment&label=Weird&atRisk=7",
    );

    const location = screen.getByTestId("location").textContent ?? "";
    expect(location).toContain("segment=all");
    expect(location).toContain("label=all");
    expect(location).toContain("atRisk=0");
  });

  it("drops a student parameter that no longer matches the filter", () => {
    renderStudents(
      "/app/ws_test/matching-runs/run-100/students?segment=all&label=all&atRisk=0&student=MR404",
    );

    expect(screen.queryByText("Student summary")).not.toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).not.toContain("student=MR404");
  });

  it("warns when a single segment's results include generated profiles", () => {
    useRunStudentsQueryMock.mockReturnValue(
      studentsQuery({ data: { ...STUDENTS, has_generated_profiles: true } }),
    );

    renderStudents(
      "/app/ws_test/matching-runs/run-100/students?segment=M_1st_year_AC_2&label=all&atRisk=0",
    );

    expect(screen.getByText("Generated data present")).toBeInTheDocument();
  });

  it("explains an empty run for the selected segment", () => {
    useRunStudentsAllSegmentsQueryMock.mockReturnValue({
      students: [],
      isLoading: false,
      isError: false,
      error: null,
      refetchAll: refetchAllMock,
    });

    renderStudents("/app/ws_test/matching-runs/run-100/students?segment=all");

    expect(screen.getByText("This run has no students for this segment")).toBeInTheDocument();
  });

  it("reports a student read failure for a single segment and retries", () => {
    useRunStudentsQueryMock.mockReturnValue(
      studentsQuery({ isError: true, data: undefined, error: new Error("segment students failed") }),
    );

    renderStudents(
      "/app/ws_test/matching-runs/run-100/students?segment=M_1st_year_AC_2&label=all&atRisk=0",
    );

    expect(screen.getByText("Student results could not be read")).toBeInTheDocument();
    expect(screen.getByText("segment students failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetchStudentsMock).toHaveBeenCalledTimes(1);
  });

  it("retries the all-segments read when it fails", () => {
    useRunStudentsAllSegmentsQueryMock.mockReturnValue({
      students: [],
      isLoading: false,
      isError: true,
      error: new Error("all segments failed"),
      refetchAll: refetchAllMock,
    });

    renderStudents("/app/ws_test/matching-runs/run-100/students?segment=all&label=all&atRisk=0");

    expect(screen.getByText("all segments failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetchAllMock).toHaveBeenCalledTimes(1);
  });

  it("shows a loading note while students are read", () => {
    useRunStudentsAllSegmentsQueryMock.mockReturnValue({
      students: [],
      isLoading: true,
      isError: false,
      error: null,
      refetchAll: refetchAllMock,
    });

    renderStudents("/app/ws_test/matching-runs/run-100/students?segment=all&label=all&atRisk=0");

    expect(screen.getByText("Reading students")).toBeInTheDocument();
  });
});
