import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FileUploadPanel } from "../../components/FileUploadPanel";

function renderPanel(templateHref?: string) {
  return render(
    <FileUploadPanel
      title="Students CSV"
      description="Upload the roster."
      buttonLabel="Upload"
      onUpload={vi.fn()}
      isUploading={false}
      templateHref={templateHref}
    />,
  );
}

describe("FileUploadPanel template link", () => {
  it("links a downloadable CSV template when a template is set", () => {
    renderPanel("/templates/students.csv");

    const link = screen.getByRole("link", { name: /download the csv template/i });
    expect(link).toHaveAttribute("href", "/templates/students.csv");
    expect(link).toHaveAttribute("download");
  });

  it("omits the template link when no template is set", () => {
    renderPanel();

    expect(
      screen.queryByRole("link", { name: /download the csv template/i }),
    ).not.toBeInTheDocument();
  });
});
