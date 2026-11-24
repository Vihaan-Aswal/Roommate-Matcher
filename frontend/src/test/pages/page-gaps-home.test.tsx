import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import { HomePage } from "../../pages/HomePage";

describe("HomePage interactions", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  function renderHome() {
    return render(
      <MemoryRouter
        initialEntries={["/"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <HomePage />
      </MemoryRouter>,
    );
  }

  it("titles the tab while it is open and restores the old title on leave", () => {
    document.title = "Previous title";

    const { unmount } = renderHome();

    expect(document.title).toBe(
      "Roommate Matcher — a room-allocation desk for hostel offices",
    );

    unmount();

    expect(document.title).toBe("Previous title");
  });

  it("plays the sample run and scrolls to the film", () => {
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: /^play the sample run$/i }));

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("group", { name: /sample run film/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replay film" })).toBeInTheDocument();
  });

  it("replays the film from the stage control", () => {
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: "Replay film" }));

    expect(screen.getByText(/cold open · the desk at night/i)).toBeInTheDocument();
    expect(screen.getByRole("figure")).toBeInTheDocument();
  });

  it("links every call to action to the login desk", () => {
    renderHome();

    const deskLinks = screen.getAllByRole("link", { name: /open the desk/i });
    expect(deskLinks.length).toBeGreaterThan(0);
    deskLinks.forEach((link) => expect(link).toHaveAttribute("href", "/login"));
    expect(screen.getByRole("link", { name: /back to top/i })).toHaveAttribute("href", "#top");
  });
});
