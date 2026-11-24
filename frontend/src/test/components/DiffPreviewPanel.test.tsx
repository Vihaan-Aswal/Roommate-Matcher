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
    removal_confirmation_required: false,
  };

  beforeEach(() => {
    mockOnConfirm.mockReset();
    mockOnCancel.mockReset();
  });

  it("renders with student diff and calls callbacks", () => {
    render(
      <DiffPreviewPanel
        title="Students Upload Preview"
        toInsert={studentDiff.to_insert}
        toUpdate={studentDiff.to_update}
        toSoftDelete={studentDiff.to_soft_delete}
        unchanged={studentDiff.unchanged}
        validCsvRows={studentDiff.valid_csv_rows}
        validationErrors={studentDiff.validation_errors}
        workspaceWarnings={studentDiff.warnings}
        diffEntries={[]}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isApplying={false}
      />,
    );

    // Verify stats
    expect(screen.getByText("Adding")).toBeInTheDocument();
    expect(screen.getByText("Updating")).toBeInTheDocument();
    expect(screen.getByText("Removing")).toBeInTheDocument();
    expect(screen.getByText("Unchanged")).toBeInTheDocument();

    // Verify warnings
    expect(screen.getByText("Warning 1")).toBeInTheDocument();

    // Verify buttons
    fireEvent.click(screen.getByRole("button", { name: /confirm & apply/i }));
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it("blocks apply and explains when the file has no valid rows", () => {
    render(
      <DiffPreviewPanel
        title="Students Upload Preview"
        toInsert={0}
        toUpdate={0}
        toSoftDelete={0}
        unchanged={0}
        validCsvRows={0}
        validationErrors={[]}
        workspaceWarnings={[]}
        diffEntries={[]}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isApplying={false}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/no valid rows/i);
    expect(screen.getByRole("button", { name: /confirm & apply/i })).toBeDisabled();
  });

  it("requires a checked confirmation before a mass removal", () => {
    render(
      <DiffPreviewPanel
        title="Students Upload Preview"
        toInsert={0}
        toUpdate={0}
        toSoftDelete={11}
        unchanged={1}
        validCsvRows={1}
        removalConfirmationRequired
        validationErrors={[]}
        workspaceWarnings={[]}
        diffEntries={[]}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isApplying={false}
      />,
    );

    expect(screen.getByText(/removes 11 of the 12/i)).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: /confirm & apply/i });
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /reviewed/i }));
    expect(confirm).not.toBeDisabled();

    fireEvent.click(confirm);
    expect(mockOnConfirm).toHaveBeenCalledWith(true);
  });
});
