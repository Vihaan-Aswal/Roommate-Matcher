import { screen } from "@testing-library/react";
import { vi } from "vitest";

import { AdminFormCollection } from "../pages/AdminFormCollection";
import { renderWithProviders } from "./renderWithProviders";

const { useAdminFormStatusQueryMock, useAdminNonSubmittersQueryMock } =
  vi.hoisted(() => ({
    useAdminFormStatusQueryMock: vi.fn(),
    useAdminNonSubmittersQueryMock: vi.fn(),
  }));

vi.mock("../hooks/useAdminFormCollection", () => ({
  useAdminFormStatusQuery: useAdminFormStatusQueryMock,
  useAdminNonSubmittersQuery: useAdminNonSubmittersQueryMock,
}));

describe("AdminFormCollection", () => {
  beforeEach(() => {
    useAdminFormStatusQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        total_students: 30,
        valid_responses: 21,
        invalid_responses: 2,
        percentage_valid: 70,
        by_segment: [
          {
            segment_key: "M_1st_year_AC_2",
            total: 10,
            valid: 8,
            percentage: 80,
          },
        ],
      },
      error: null,
    });

    useAdminNonSubmittersQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        non_submitters: [
          {
            admission_number: "ADM500",
            full_name: "No Submit",
            segment_key: "M_1st_year_AC_2",
          },
        ],
        total_count: 1,
      },
      error: null,
    });
  });

  it("renders form collection metrics and non-submitter rows", () => {
    renderWithProviders(<AdminFormCollection />);

    expect(screen.getByText("Form & Collection")).toBeInTheDocument();
    expect(screen.getByText("Completion by Segment")).toBeInTheDocument();
    expect(screen.getByText("No Submit")).toBeInTheDocument();
    expect(screen.getByText("Q1 Sleep Schedule")).toBeInTheDocument();
  });
});
