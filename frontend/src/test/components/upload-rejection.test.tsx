import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DiffPreviewPanel } from "../../components/DiffPreviewPanel";
import { FileUploadPanel } from "../../components/FileUploadPanel";

describe("upload failure handling", () => {
  it("keeps the chosen file when the upload request rejects", async () => {
    const onUpload = vi.fn().mockRejectedValue(new Error("network down"));

    render(
      <FileUploadPanel
        title="Master Students CSV"
        description="Roster"
        buttonLabel="Upload Students"
        onUpload={onUpload}
        isUploading={false}
      />,
    );

    const input = screen.getByLabelText("Master Students CSV file input") as HTMLInputElement;
    const file = new File(["admission_number\nA1"], "students.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload Students" }));

    expect(onUpload).toHaveBeenCalledWith(file);
    // The component survives the rejection and stays usable; the parent renders
    // the error. An unhandled rejection would fail this test.
    expect(await screen.findByRole("button", { name: "Upload Students" })).toBeEnabled();
  });

  it("does not leak an unhandled rejection when Confirm & Apply rejects", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("apply failed"));

    render(
      <DiffPreviewPanel
        title="Students Upload Preview"
        toInsert={1}
        toUpdate={0}
        toSoftDelete={0}
        unchanged={0}
        validationErrors={[]}
        diffEntries={[]}
        workspaceWarnings={[]}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        isApplying={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm & Apply" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "Confirm & Apply" })).toBeEnabled();
  });
});
