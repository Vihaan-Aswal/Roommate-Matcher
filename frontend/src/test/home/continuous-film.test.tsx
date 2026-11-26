import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContinuousFilm } from "../../components/home/ContinuousFilm";
import { run } from "../../components/home/simulate";
import { HomePage } from "../../pages/HomePage";

const originalMatchMedia = window.matchMedia;

function renderFilm() {
  return render(
    <MemoryRouter>
      <ContinuousFilm run={run} playKey={0} />
    </MemoryRouter>,
  );
}

function reducedMotionOnly() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", undefined);
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.matchMedia = originalMatchMedia;
  delete (document as unknown as { visibilityState?: string }).visibilityState;
});

describe("ContinuousFilm", () => {
  it("autoplays one continuous take and pauses on demand", () => {
    renderFilm();

    expect(
      screen.getByRole("group", { name: "Continuous sample run film" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause film" })).toBeInTheDocument();
    expect(
      screen.getByText("96 responses. 38 rooms. One desk."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /previous|next/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pause film" }));
    expect(screen.getByRole("button", { name: "Play film" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Play film" }));
    expect(screen.getByRole("button", { name: "Pause film" })).toBeInTheDocument();
  });

  it("seeks by chapter and pauses there", () => {
    renderFilm();

    fireEvent.click(
      screen.getByRole("button", { name: /Chapter 2: 0:03 Boundary/i }),
    );

    expect(
      screen.getByText("4,560 possible pairs → 1,104 scored."),
    ).toBeInTheDocument();
    expect(screen.getByText("3,456 never compared.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play film" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Chapter 2: 0:03 Boundary/i }),
    ).toHaveAttribute("aria-current", "step");

    fireEvent.click(
      screen.getByRole("button", { name: /Chapter 3: 0:05 R-12/i }),
    );
    expect(screen.getByText("S-009 × S-021 — 0.416.")).toBeInTheDocument();
  });

  it("starts on mount even when an intersection observer never fires", () => {
    const observe = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe = observe;
        disconnect = vi.fn();
        unobserve = vi.fn();
        takeRecords = () => [];
        root = null;
        rootMargin = "";
        thresholds = [];
      },
    );
    renderFilm();

    expect(
      screen.getByRole("button", { name: "Pause film", exact: true }),
    ).toBeInTheDocument();
    expect(observe).not.toHaveBeenCalled();
  });

  it("starts when a hidden page becomes visible", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    renderFilm();
    expect(
      screen.getByRole("button", { name: "Play film", exact: true }),
    ).toBeInTheDocument();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(
      screen.getByRole("button", { name: "Pause film", exact: true }),
    ).toBeInTheDocument();
  });

  it("keeps the take running when the os prefers reduced motion", () => {
    reducedMotionOnly();
    renderFilm();

    expect(screen.getByRole("button", { name: "Pause film" })).toBeInTheDocument();
    expect(screen.queryByText(/static/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /previous|next/i })).not.toBeInTheDocument();
  });

  it("stays available only behind ?continuous=1", () => {
    window.history.pushState({}, "Continuous", "/?continuous=1");
    render(
      <MemoryRouter initialEntries={["/?continuous=1"]}>
        <HomePage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("group", { name: "Continuous sample run film" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Sample run film" }),
    ).not.toBeInTheDocument();

    window.history.pushState({}, "Classic", "/");
  });
});
