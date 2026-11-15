import { fireEvent, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { AdminStudentsData } from "../../pages/AdminStudentsData";
import { renderWithProviders } from "../renderWithProviders";

const {
  usePreviewStudentUploadMutationMock,
  useApplyStudentUploadMutationMock,
  usePreviewRoomUploadMutationMock,
  useApplyRoomUploadMutationMock,
  useAdminFormStatusQueryMock,
} = vi.hoisted(() => ({
  usePreviewStudentUploadMutationMock: vi.fn(),
  useApplyStudentUploadMutationMock: vi.fn(),
  usePreviewRoomUploadMutationMock: vi.fn(),
  useApplyRoomUploadMutationMock: vi.fn(),
  useAdminFormStatusQueryMock: vi.fn(),
}));

const previewStudentsMock = vi.fn();
const applyStudentsMock = vi.fn();
const previewRoomsMock = vi.fn();
const applyRoomsMock = vi.fn();

vi.mock("../../hooks/useAdminUploads", () => ({
  usePreviewStudentUploadMutation: usePreviewStudentUploadMutationMock,
  useApplyStudentUploadMutation: useApplyStudentUploadMutationMock,
  usePreviewRoomUploadMutation: usePreviewRoomUploadMutationMock,
  useApplyRoomUploadMutation: useApplyRoomUploadMutationMock,
}));

vi.mock("../../hooks/useAdminFormCollection", () => ({
  useAdminFormStatusQuery: useAdminFormStatusQueryMock,
}));

const ROOM_DIFF = {
  workspace_id: "ws_test",
  total_csv_rows: 2,
  valid_csv_rows: 2,
  to_insert: 1,
  to_update: 1,
  to_soft_delete: 0,
  unchanged: 0,
  validation_errors: [],
  warnings: ["Rooms outside a known segment are kept but not matched."],
  diff_entries: [
    {
      room_id: "A-101",
      segment_key: "M_1st_year_AC_2",
      action: "insert",
      changes: { capacity: { old: null, new: "2" } },
      warnings: ["New room"],
    },
    {
      room_id: "A-102",
      segment_key: "M_1st_year_AC_2",
      action: "update",
      changes: null,
      warnings: [],
    },
  ],
};

const ROOM_APPLY = {
  workspace_id: "ws_test",
  inserted: 1,
  updated: 1,
  soft_deleted: 0,
  unchanged: 3,
  segments_created: 0,
  errors: [],
};

const STUDENT_DIFF = {
  workspace_id: "ws_test",
  total_csv_rows: 3,
  valid_csv_rows: 2,
  to_insert: 1,
  to_update: 0,
  to_soft_delete: 0,
  unchanged: 1,
  validation_errors: [
    { row_number: 3, field: "dob", reason: "invalid_date", raw_value: "not-a-date" },
  ],
  warnings: [],
  diff_entries: [
    {
      admission_number: "ADM101",
      full_name: "Test One",
      action: "insert",
      changes: null,
      warnings: [],
    },
    {
      admission_number: "ADM102",
      full_name: "Test Two",
      action: "soft_delete",
      changes: { phone_number: { old: "9876543210", new: null } },
      warnings: [],
    },
  ],
};

function mutation(overrides: Record<string, unknown> = {}) {
  return {
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

function selectFile(label: RegExp, fileName: string) {
  const file = new File(["a,b\n1,2\n"], fileName, { type: "text/csv" });
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
  return file;
}

describe("AdminStudentsData upload flows", () => {
  beforeEach(() => {
    previewStudentsMock.mockReset();
    applyStudentsMock.mockReset();
    previewRoomsMock.mockReset();
    applyRoomsMock.mockReset();

    usePreviewStudentUploadMutationMock.mockReturnValue(
      mutation({ mutateAsync: previewStudentsMock }),
    );
    useApplyStudentUploadMutationMock.mockReturnValue(
      mutation({ mutateAsync: applyStudentsMock }),
    );
    usePreviewRoomUploadMutationMock.mockReturnValue(
      mutation({ mutateAsync: previewRoomsMock }),
    );
    useApplyRoomUploadMutationMock.mockReturnValue(
      mutation({ mutateAsync: applyRoomsMock }),
    );
    useAdminFormStatusQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        total_students: 20,
        valid_responses: 15,
        invalid_responses: 2,
        percentage_valid: 75,
        by_segment: [],
      },
      error: null,
    });
  });

  it("previews a room file, applies it, and resets the panel", async () => {
    previewRoomsMock.mockResolvedValue(ROOM_DIFF);
    applyRoomsMock.mockResolvedValue(ROOM_APPLY);

    renderWithProviders(<AdminStudentsData />);

    const file = selectFile(/rooms csv file input/i, "rooms.csv");
    fireEvent.click(screen.getByRole("button", { name: /upload rooms/i }));

    expect(await screen.findByRole("heading", { name: "Rooms Upload Preview" })).toBeInTheDocument();
    expect(screen.getByText("A-101")).toBeInTheDocument();
    expect(screen.getByText(/kept but not matched/i)).toBeInTheDocument();
    expect(previewRoomsMock).toHaveBeenCalledWith(file);

    fireEvent.click(screen.getByRole("button", { name: /confirm & apply/i }));

    expect(await screen.findByText("Rooms Applied Successfully")).toBeInTheDocument();
    expect(screen.getByText("Inserted")).toBeInTheDocument();
    expect(applyRoomsMock).toHaveBeenCalledWith(file);

    fireEvent.click(screen.getByRole("button", { name: /upload another file/i }));

    expect(screen.queryByText("Rooms Applied Successfully")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rooms CSV" })).toBeInTheDocument();
  });

  it("cancels a students preview without writing anything", async () => {
    previewStudentsMock.mockResolvedValue(STUDENT_DIFF);

    renderWithProviders(<AdminStudentsData />);

    selectFile(/master students csv file input/i, "students.csv");
    fireEvent.click(screen.getByRole("button", { name: /upload students/i }));

    expect(await screen.findByRole("heading", { name: "Students Upload Preview" })).toBeInTheDocument();
    expect(screen.getByText("1 row cannot be read")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show the rows/i }));
    expect(screen.getByText("not-a-date")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByText("Students Upload Preview")).not.toBeInTheDocument();
    expect(applyStudentsMock).not.toHaveBeenCalled();
  });

  it("applies a students file and resets the panel for the next upload", async () => {
    previewStudentsMock.mockResolvedValue(STUDENT_DIFF);
    applyStudentsMock.mockResolvedValue({
      workspace_id: "ws_test",
      inserted: 1,
      updated: 0,
      soft_deleted: 1,
      unchanged: 1,
      segments_created: 1,
      errors: [],
    });

    renderWithProviders(<AdminStudentsData />);

    selectFile(/master students csv file input/i, "students.csv");
    fireEvent.click(screen.getByRole("button", { name: /upload students/i }));

    expect(
      await screen.findByRole("heading", { name: "Students Upload Preview" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /confirm & apply/i }));

    expect(await screen.findByText("Students Applied Successfully")).toBeInTheDocument();
    expect(screen.getByText("Removed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /upload another file/i }));

    expect(screen.queryByText("Students Applied Successfully")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Master Students CSV" })).toBeInTheDocument();
  });

  it("cancels a rooms preview without writing anything", async () => {
    previewRoomsMock.mockResolvedValue(ROOM_DIFF);

    renderWithProviders(<AdminStudentsData />);

    selectFile(/rooms csv file input/i, "rooms.csv");
    fireEvent.click(screen.getByRole("button", { name: /upload rooms/i }));

    expect(
      await screen.findByRole("heading", { name: "Rooms Upload Preview" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByText("Rooms Upload Preview")).not.toBeInTheDocument();
    expect(applyRoomsMock).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Rooms CSV" })).toBeInTheDocument();
  });

  it("reports a students file that could not be read", () => {
    usePreviewStudentUploadMutationMock.mockReturnValue(
      mutation({
        mutateAsync: previewStudentsMock,
        isError: true,
        error: new Error("bad csv header"),
      }),
    );

    renderWithProviders(<AdminStudentsData />);

    expect(screen.getByText("The file was not read")).toBeInTheDocument();
    expect(screen.getByText("bad csv header")).toBeInTheDocument();
  });

  it("reports a rooms file that could not be read", () => {
    usePreviewRoomUploadMutationMock.mockReturnValue(
      mutation({
        mutateAsync: previewRoomsMock,
        isError: true,
        error: new Error("rooms csv broken"),
      }),
    );

    renderWithProviders(<AdminStudentsData />);

    expect(screen.getByText("rooms csv broken")).toBeInTheDocument();
  });

  it("reports a students file that could not be applied, above the preview", async () => {
    previewStudentsMock.mockResolvedValue(STUDENT_DIFF);
    useApplyStudentUploadMutationMock.mockReturnValue(
      mutation({
        mutateAsync: applyStudentsMock,
        isError: true,
        error: new Error("apply rejected"),
      }),
    );

    renderWithProviders(<AdminStudentsData />);

    selectFile(/master students csv file input/i, "students.csv");
    fireEvent.click(screen.getByRole("button", { name: /upload students/i }));

    expect(await screen.findByText("The file was not applied")).toBeInTheDocument();
    expect(screen.getByText("apply rejected")).toBeInTheDocument();
  });

  it("reports a rooms file that could not be applied", async () => {
    previewRoomsMock.mockResolvedValue(ROOM_DIFF);
    useApplyRoomUploadMutationMock.mockReturnValue(
      mutation({
        mutateAsync: applyRoomsMock,
        isError: true,
        error: new Error("rooms apply rejected"),
      }),
    );

    renderWithProviders(<AdminStudentsData />);

    selectFile(/rooms csv file input/i, "rooms.csv");
    fireEvent.click(screen.getByRole("button", { name: /upload rooms/i }));

    expect(await screen.findByText("rooms apply rejected")).toBeInTheDocument();
  });
});

describe("AdminStudentsData response snapshot", () => {
  beforeEach(() => {
    usePreviewStudentUploadMutationMock.mockReturnValue(mutation());
    useApplyStudentUploadMutationMock.mockReturnValue(mutation());
    usePreviewRoomUploadMutationMock.mockReturnValue(mutation());
    useApplyRoomUploadMutationMock.mockReturnValue(mutation());
  });

  it("counts responses while loading", () => {
    useAdminFormStatusQueryMock.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
      error: null,
    });

    renderWithProviders(<AdminStudentsData />);

    expect(screen.getByText("Counting responses")).toBeInTheDocument();
  });

  it("reports unavailable response counts", () => {
    useAdminFormStatusQueryMock.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      error: new Error("status failed"),
    });

    renderWithProviders(<AdminStudentsData />);

    expect(screen.getByText("Response counts are unavailable")).toBeInTheDocument();
    expect(screen.getByText("status failed")).toBeInTheDocument();
  });

  it("shows the roster snapshot figures", () => {
    useAdminFormStatusQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        total_students: 20,
        valid_responses: 15,
        invalid_responses: 2,
        percentage_valid: 75,
        by_segment: [],
      },
      error: null,
    });

    renderWithProviders(<AdminStudentsData />);

    expect(screen.getByText("Valid Responses")).toBeInTheDocument();
    expect(screen.getAllByText("20").length).toBeGreaterThan(0);
  });
});
