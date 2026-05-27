import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";

import { DiffPreviewPanel } from "../../components/DiffPreviewPanel";
import {
  StudentImportDiffResponse,
  RoomImportDiffResponse,
} from "../../lib/apiClient";

describe("DiffPreviewPanel", () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  const studentDiff: StudentImportDiffResponse = {
    workspace_id: "ws-1",
    total_csv_rows: 10,
    valid_csv_rows: 10,
    to_insert: 2,
    to_update: 1,
    to_soft_delete: 1,
    unchanged: 6,
    validation_errors: [],
    diff_entries: [],
    warnings: ["Warning 1"],
  };

  beforeEach(() => {
    mockOnConfirm.mockReset();
    mockOnCancel.mockReset();
  });

  it("renders with student diff and calls callbacks", () => {
    render(
      <DiffPreviewPanel
        diff={studentDiff}
        type="students"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isApplying={false}
      />,
    );

    // Verify stats
    expect(screen.getByTestId("stat-adding")).toHaveTextContent("2");
    expect(screen.getByTestId("stat-updating")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-removing")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-unchanged")).toHaveTextContent("6");

    // Verify warnings
    expect(screen.getByText("Warning 1")).toBeInTheDocument();

    // Verify buttons
    fireEvent.click(screen.getByRole("button", { name: /confirm & apply/i }));
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });
});
