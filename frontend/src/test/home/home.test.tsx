import { render, screen } from "@testing-library/react";
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
    deskLinks.forEach((link) => expect(link).toHaveAttribute("href", "/login"));
    expect(
      screen.getByRole("button", { name: /^play the sample run$/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /sample run film/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /chapter 1: the boundary decides first/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /sign in/i })).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("keeps the classic film by default and serves the pipeline spike at ?pipeline=1", () => {
    window.history.pushState({}, "Homepage", "/");
    const classic = render(<App />);
    expect(screen.getByRole("group", { name: /sample run film/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: /cohort pipeline animation/i }),
    ).not.toBeInTheDocument();
    classic.unmount();

    window.history.pushState({}, "Pipeline", "/?pipeline=1");
    render(<App />);
    expect(
      screen.getByRole("group", { name: /cohort pipeline animation/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /sample run film/i })).not.toBeInTheDocument();
    expect(
      screen.getByText("A roster, a room list, a private form."),
    ).toBeInTheDocument();
  });
});

