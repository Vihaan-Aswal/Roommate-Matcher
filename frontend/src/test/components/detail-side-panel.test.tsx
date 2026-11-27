import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { DetailSidePanelShell } from "../../components/panels/DetailSidePanelShell";

function Harness(): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open details
      </button>
      <DetailSidePanelShell open={open} title="Student" onClose={() => setOpen(false)}>
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </DetailSidePanelShell>
    </div>
  );
}

describe("DetailSidePanelShell", () => {
  it("keeps Tab inside the drawer and restores focus on close", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open details" });
    opener.focus();

    fireEvent.click(opener);
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Last action" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
