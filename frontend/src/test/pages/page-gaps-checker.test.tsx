import { fireEvent, screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";

import { AdminManualChecker } from "../../pages/AdminManualChecker";
import { ManualCheckerPage } from "../../pages/checker/ManualCheckerPage";
import { renderWithProviders } from "../renderWithProviders";

const {
  useAdminSegmentsQueryMock,
  useSegmentStudentsQueryMock,
  useManualCheckerMutationMock,
} = vi.hoisted(() => ({
  useAdminSegmentsQueryMock: vi.fn(),
  useSegmentStudentsQueryMock: vi.fn(),
  useManualCheckerMutationMock: vi.fn(),
}));

vi.mock("../../hooks/useAdminSegments", () => ({
  useAdminSegmentsQuery: useAdminSegmentsQueryMock,
}));

vi.mock("../../hooks/useSegmentStudentsQuery", () => ({
  useSegmentStudentsQuery: useSegmentStudentsQueryMock,
}));

vi.mock("../../hooks/useManualCheckerMutation", () => ({
  useManualCheckerMutation: useManualCheckerMutationMock,
}));

vi.mock("@radix-ui/react-select", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  const Dummy = React.forwardRef(({ children }: any, ref: any) => children || null);
  Dummy.displayName = "Dummy";

  return {
    Root: ({ children, value, onValueChange }: any) => (
      <select value={value} onChange={(e) => onValueChange?.(e.target.value)}>
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

const mutateAsyncMock = vi.fn();
const refetchSegmentsMock = vi.fn();
const refetchStudentsMock = vi.fn();

const SEGMENT = {
  segment_key: "M_1st_year_AC_3",
  gender: "M",
  year_group: "1st_year",
  ac_type: "AC",
  room_size: 3,
  status: "Ready",
  student_count: 30,
  total_capacity: 30,
  missing_preferences_count: 0,
  missing_preferences_ratio: 0,
};

const SEGMENT_STUDENTS = {
  segment_key: "M_1st_year_AC_3",
  room_size: 3,
  students: [
    {
      admission_number: "MR001",
      full_name: "Student One",
      has_valid_preferences: true,
      preference_status: "valid",
    },
    {
      admission_number: "MR002",
      full_name: "Student Two",
      has_valid_preferences: true,
      preference_status: "valid",
    },
    {
      admission_number: "MR003",
      full_name: "Student Three",
      has_valid_preferences: true,
      preference_status: "valid",
    },
    {
      admission_number: "MR004",
      full_name: "Student Four",
      has_valid_preferences: false,
      preference_status: "missing",
    },
  ],
};

function segmentsQuery(overrides: Record<string, unknown> = {}) {
  return {
    isLoading: false,
    isError: false,
    data: { segments: [SEGMENT] },
    error: null,
    refetch: refetchSegmentsMock,
    ...overrides,
  };
}

function segmentStudentsQuery(overrides: Record<string, unknown> = {}) {
  return {
    isLoading: false,
    isError: false,
    data: SEGMENT_STUDENTS,
    error: null,
    refetch: refetchStudentsMock,
    ...overrides,
  };
}

function checkerMutation(overrides: Record<string, unknown> = {}) {
  return {
    mutateAsync: mutateAsyncMock,
    isPending: false,
    isError: false,
    data: null,
    error: null,
    ...overrides,
  };
}

describe("ManualCheckerPage states", () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    refetchSegmentsMock.mockReset();
    refetchStudentsMock.mockReset();
    useAdminSegmentsQueryMock.mockReturnValue(segmentsQuery());
    useSegmentStudentsQueryMock.mockReturnValue(segmentStudentsQuery());
    useManualCheckerMutationMock.mockReturnValue(checkerMutation());
  });

  function renderChecker(initialEntry = "/app/ws_test/manual-checker?segment=M_1st_year_AC_3") {
    renderWithProviders(
      <Routes>
        <Route path="/app/:workspaceId/manual-checker" element={<AdminManualChecker />} />
      </Routes>,
      { initialEntries: [initialEntry] },
    );
  }

  it("reports unreadable segments and retries", () => {
    useAdminSegmentsQueryMock.mockReturnValue(
      segmentsQuery({ isError: true, data: undefined, error: new Error("segments failed") }),
    );

    renderChecker();

    expect(screen.getByText("Segments are unavailable")).toBeInTheDocument();
    expect(screen.getByText("segments failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetchSegmentsMock).toHaveBeenCalledTimes(1);
  });

  it("reports an unreadable segment roster and retries", () => {
    useSegmentStudentsQueryMock.mockReturnValue(
      segmentStudentsQuery({
        isError: true,
        data: undefined,
        error: new Error("roster failed"),
      }),
    );

    renderChecker();

    expect(screen.getByText("This segment's roster is unavailable")).toBeInTheDocument();
    expect(screen.getByText("roster failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetchStudentsMock).toHaveBeenCalledTimes(1);
  });

  it("shows a reading note while the roster loads", () => {
    useAdminSegmentsQueryMock.mockReturnValue(
      segmentsQuery({ isLoading: true, data: undefined }),
    );

    renderChecker();

    expect(screen.getByText("Reading the roster")).toBeInTheDocument();
  });

  it("waits for both datasets before showing the workbench", () => {
    useAdminSegmentsQueryMock.mockReturnValue(segmentsQuery({ data: undefined }));

    renderChecker("/app/ws_test/manual-checker");

    expect(screen.getByText("No segment selected")).toBeInTheDocument();
    expect(screen.queryByText("Build the group")).not.toBeInTheDocument();
  });

  it("asks for a segment when the workspace has none", () => {
    useAdminSegmentsQueryMock.mockReturnValue(segmentsQuery({ data: { segments: [] } }));
    useSegmentStudentsQueryMock.mockReturnValue(
      segmentStudentsQuery({ data: { ...SEGMENT_STUDENTS, room_size: 0 } }),
    );

    renderChecker("/app/ws_test/manual-checker");

    expect(screen.getByText("Select a segment.")).toBeInTheDocument();
    expect(screen.getByText("Room size unknown")).toBeInTheDocument();
  });

  it("explains an unknown room size", () => {
    useAdminSegmentsQueryMock.mockReturnValue(segmentsQuery({ data: { segments: [] } }));
    useSegmentStudentsQueryMock.mockReturnValue(
      segmentStudentsQuery({ data: { ...SEGMENT_STUDENTS, room_size: 0 } }),
    );

    renderChecker("/app/ws_test/manual-checker?segment=M_1st_year_AC_3");

    expect(
      screen.getByText("Room size is unavailable for the selected segment."),
    ).toBeInTheDocument();
  });

  it("counts the selections against the room size", () => {
    renderChecker();

    expect(screen.getByText("Select exactly 2 existing students.")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/MR001 - Student One/i));
    fireEvent.click(screen.getByLabelText(/MR002 - Student Two/i));
    expect(screen.getByText("Select one candidate student.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/candidate student/i), {
      target: { value: "MR003" },
    });

    expect(screen.getByText("Ready to run compatibility report.")).toBeInTheDocument();
  });

  it("filters the roster by name or admission number", () => {
    renderChecker();

    fireEvent.change(screen.getByLabelText(/search students/i), {
      target: { value: "Student Four" },
    });

    expect(screen.getByLabelText(/MR004 - Student Four/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/MR001 - Student One/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/search students/i), {
      target: { value: "nobody" },
    });
    expect(screen.getByText("No student matches that search.")).toBeInTheDocument();
  });

  it("clears the candidate when that student is moved into the room", () => {
    renderChecker();

    fireEvent.change(screen.getByLabelText(/candidate student/i), {
      target: { value: "MR004" },
    });
    expect((screen.getByLabelText(/candidate student/i) as HTMLSelectElement).value).toBe(
      "MR004",
    );

    fireEvent.click(screen.getByLabelText(/MR004 - Student Four/i));

    expect((screen.getByLabelText(/candidate student/i) as HTMLSelectElement).value).toBe(
      "none",
    );
  });

  it("resets the selection when the segment changes", () => {
    useAdminSegmentsQueryMock.mockReturnValue(
      segmentsQuery({ data: { segments: [SEGMENT, { ...SEGMENT, segment_key: "F_1st_year_AC_3" }] } }),
    );

    renderChecker();

    fireEvent.click(screen.getByLabelText(/MR001 - Student One/i));
    expect(screen.getByText(/1 chosen/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Segment"), {
      target: { value: "F_1st_year_AC_3" },
    });

    expect(screen.getByText(/0 chosen/)).toBeInTheDocument();
    expect(screen.getByText("Select exactly 2 existing students.")).toBeInTheDocument();
  });

  it("reports a checker failure", () => {
    useManualCheckerMutationMock.mockReturnValue(
      checkerMutation({ isError: true, error: new Error("checker exploded") }),
    );

    renderChecker();

    expect(screen.getByText("The checker could not finish")).toBeInTheDocument();
    expect(screen.getByText("checker exploded")).toBeInTheDocument();
  });

  it("shows the scoring state while the report runs", () => {
    useManualCheckerMutationMock.mockReturnValue(checkerMutation({ isPending: true }));

    renderChecker();

    expect(screen.getByText("Scoring the group")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Running…" })).toBeDisabled();
  });

  it("does nothing when the report is run before the selection is valid", () => {
    renderChecker();

    const runButton = screen.getByRole("button", { name: /run compatibility report/i });
    expect(runButton).toBeDisabled();

    fireEvent.click(runButton);
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it("renders the page component directly with the same workbench", () => {
    renderWithProviders(
      <Routes>
        <Route path="/app/:workspaceId/manual-checker" element={<ManualCheckerPage />} />
      </Routes>,
      { initialEntries: ["/app/ws_test/manual-checker?segment=M_1st_year_AC_3"] },
    );

    expect(screen.getByRole("heading", { level: 1, name: "Manual Checker" })).toBeInTheDocument();
    expect(screen.getByText("Build the group")).toBeInTheDocument();
  });
});
