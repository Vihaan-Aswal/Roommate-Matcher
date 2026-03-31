import { fireEvent, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { AdminStudentsData } from "../pages/AdminStudentsData";
import { renderWithProviders } from "./renderWithProviders";

const { useUploadStudentsMutationMock, useUploadRoomsMutationMock, useAdminFormStatusQueryMock } =
  vi.hoisted(() => ({
    useUploadStudentsMutationMock: vi.fn(),
    useUploadRoomsMutationMock: vi.fn(),
    useAdminFormStatusQueryMock: vi.fn(),
  }));

const studentsMutateAsyncMock = vi.fn();
const roomsMutateAsyncMock = vi.fn();

vi.mock("../hooks/useAdminUploads", () => ({
  useUploadStudentsMutation: useUploadStudentsMutationMock,
  useUploadRoomsMutation: useUploadRoomsMutationMock,
}));

vi.mock("../hooks/useAdminFormCollection", () => ({
  useAdminFormStatusQuery: useAdminFormStatusQueryMock,
}));

describe("AdminStudentsData", () => {
  beforeEach(() => {
    studentsMutateAsyncMock.mockReset();
    roomsMutateAsyncMock.mockReset();

    studentsMutateAsyncMock.mockResolvedValue({
      total_rows: 12,
      accepted_rows: 10,
      rejected_rows: 2,
      duplicate_rows: 1,
      invalid_rows: [
        {
          row_number: 3,
          field: "dob",
          reason: "invalid_date",
          raw_value: "bad-date",
        },
      ],
      error_report_name: "students_errors_1.csv",
    });

    useUploadStudentsMutationMock.mockReturnValue({
      mutateAsync: studentsMutateAsyncMock,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
    });

    useUploadRoomsMutationMock.mockReturnValue({
      mutateAsync: roomsMutateAsyncMock,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
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

  it("uploads students csv and renders upload summary", async () => {
    renderWithProviders(<AdminStudentsData />);

    const fileInput = screen.getByLabelText(/master students csv file input/i);
    const file = new File(
      [
        "admission_number,full_name\\n" +
          "ADM101,Test One\\n" +
          "ADM102,Test Two\\n",
      ],
      "students.csv",
      { type: "text/csv" },
    );

    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /upload students/i }));

    await waitFor(() => {
      expect(studentsMutateAsyncMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("Students Upload Summary")).toBeInTheDocument();
    expect(screen.getByText("invalid_date")).toBeInTheDocument();
  });
});
