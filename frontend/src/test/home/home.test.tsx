import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import App from "../../App";

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    startDemo: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("public homepage route", () => {
  it("renders Roommate Matcher at / for a signed-out visitor without calling the API", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    window.history.pushState({}, "Homepage", "/");

    render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: /a room list you can sign/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/a room-allocation desk for hostel wardens/i)).toBeInTheDocument();
    expect(screen.getByText(/room allocation desk/i)).toBeInTheDocument();
    const deskLinks = screen.getAllByRole("link", { name: /open the desk/i });
    expect(deskLinks.length).toBeGreaterThan(0);
    deskLinks.forEach((link) => expect(link).toHaveAttribute("href", "/try"));
    expect(
      screen.getByRole("button", { name: /^play the sample run$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /cohort pipeline animation/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "01 Inputs · step 1 of 8" }),
    ).toBeInTheDocument();
    const stations = screen.getByRole("navigation", { name: /the eight stations/i });
    expect(within(stations).getByRole("link", { name: /03 boundaries/i })).toHaveAttribute(
      "href",
      "#boundary",
    );
    expect(within(stations).getByRole("link", { name: /01 inputs/i })).toHaveAttribute(
      "href",
      "#sample-run",
    );
    expect(screen.getByRole("heading", { name: /the film is the run/i })).toBeInTheDocument();
    const fairness = document.querySelector("#fairness");
    const artifacts = document.querySelector("#artifacts");
    expect(fairness).not.toBeNull();
    expect(artifacts).not.toBeNull();
    expect(
      fairness!.compareDocumentPosition(artifacts!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(fairness as HTMLElement).getAllByText("0.827").length).toBeGreaterThan(0);
    expect(within(fairness as HTMLElement).getAllByText("0.416").length).toBeGreaterThan(0);
    const compatibility = document.querySelector("#compatibility") as HTMLElement;
    expect(within(compatibility).getAllByText("0.733").length).toBeGreaterThan(0);
    const signoff = document.querySelector("#sign-off") as HTMLElement;
    expect(within(signoff).getAllByText("0.416").length).toBeGreaterThan(0);
    const factor = document.querySelector(".mm-factor") as HTMLElement;
    expect(within(factor).getByText("Weight")).toBeInTheDocument();
    expect(within(factor).getByText("Raw")).toBeInTheDocument();
    expect(within(factor).getByText("Points")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /sign in/i })).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("moves focus to the main argument when the skip link is used", () => {
    window.history.pushState({}, "Homepage", "/");
    render(<App />);

    fireEvent.click(screen.getByRole("link", { name: /skip to the argument/i }));

    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("serves the full pipeline by default and keeps the classic film at ?classic=1", async () => {
    window.history.pushState({}, "Homepage", "/");
    const pipeline = render(<App />);
    expect(
      screen.getByRole("group", { name: /cohort pipeline animation/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /sample run film/i })).not.toBeInTheDocument();
    expect(
      screen.getByText("A roster, a room list, a private form."),
    ).toBeInTheDocument();
    pipeline.unmount();

    window.history.pushState({}, "Classic", "/?classic=1");
    render(<App />);
    expect(
      await screen.findByRole(
        "group",
        { name: /sample run film/i },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: /cohort pipeline animation/i }),
    ).not.toBeInTheDocument();
  });
});

