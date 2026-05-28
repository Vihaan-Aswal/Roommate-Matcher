import { fireEvent, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { AdminStudentsData } from "../pages/AdminStudentsData";
import { renderWithProviders } from "./renderWithProviders";
import { MemoryRouter } from "react-router";
import { WorkspaceProvider } from "../providers/WorkspaceProvider";
import { act } from "react";

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

const studentPreviewMutateAsyncMock = vi.fn();
const studentApplyMutateAsyncMock = vi.fn();

vi.mock("../hooks/useAdminUploads", () => ({
  usePreviewStudentUploadMutation: usePreviewStudentUploadMutationMock,
  useApplyStudentUploadMutation: useApplyStudentUploadMutationMock,
  usePreviewRoomUploadMutation: usePreviewRoomUploadMutationMock,
  useApplyRoomUploadMutation: useApplyRoomUploadMutationMock,
}));

vi.mock("../hooks/useAdminFormCollection", () => ({
  useAdminFormStatusQuery: useAdminFormStatusQueryMock,
}));

describe("AdminStudentsData", () => {
  beforeEach(() => {
    studentPreviewMutateAsyncMock.mockReset();
    studentApplyMutateAsyncMock.mockReset();

    studentPreviewMutateAsyncMock.mockResolvedValue({
      workspace_id: "test",
      total_csv_rows: 2,
      valid_csv_rows: 2,
      to_insert: 2,
      to_update: 0,
      to_soft_delete: 0,
      unchanged: 0,
      validation_errors: [
        {
          row_number: 3,
          field: "dob",
          reason: "invalid_date",
          raw_value: "bad-date",
        },
      ],
      diff_entries: [],
      warnings: [],
    });

    studentApplyMutateAsyncMock.mockResolvedValue({
      workspace_id: "test",
      inserted: 2,
      updated: 0,
      soft_deleted: 0,
      unchanged: 0,
      segments_created: 0,
      errors: [],
    });

    usePreviewStudentUploadMutationMock.mockReturnValue({
      mutateAsync: studentPreviewMutateAsyncMock,
      isPending: false,
    });

    useApplyStudentUploadMutationMock.mockReturnValue({
      mutateAsync: studentApplyMutateAsyncMock,
      isPending: false,
    });

    usePreviewRoomUploadMutationMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

    useApplyRoomUploadMutationMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

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

  it("uploads students csv, reviews diff, and applies", async () => {
    renderWithProviders(<AdminStudentsData />, { initialEntries: ["/app/ws-123"] });

    const fileInput = screen.getByLabelText(/master students csv file input/i);
    const file = new File(
      [
        "admission_number,full_name,phone_number\\n" +
          "ADM101,Test One,987\\n" +
          "ADM102,Test Two,123\\n",
      ],
      "students.csv",
      { type: "text/csv" },
    );

    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /upload students/i }));

    await waitFor(() => {
      expect(studentPreviewMutateAsyncMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("Students Upload Preview")).toBeInTheDocument();

    // Apply changes
    fireEvent.click(screen.getByRole("button", { name: /confirm & apply/i }));

    await waitFor(() => {
      expect(studentApplyMutateAsyncMock).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.getByText("Students Applied Successfully"),
    ).toBeInTheDocument();
  });
});
