import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SampleRunFilm } from "../../components/home/SampleRunFilm";
import { run } from "../../components/home/simulate";

const originalMatchMedia = window.matchMedia;
const originalIntersectionObserver = window.IntersectionObserver;

function setReducedMotion(matches: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function renderFilm(reduced = false) {
  setReducedMotion(reduced);
  const onReplay = vi.fn();
  const view = render(
    <MemoryRouter>
      <SampleRunFilm run={run} playKey={0} onReplay={onReplay} />
    </MemoryRouter>,
  );
  return { ...view, onReplay };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IntersectionObserver", undefined);
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.matchMedia = originalMatchMedia;
  window.IntersectionObserver = originalIntersectionObserver;
  delete (document as unknown as { visibilityState?: string }).visibilityState;
});

describe("SampleRunFilm", () => {
  it("auto-advances through the scenes in order", () => {
    renderFilm();

    expect(screen.getByText(/Cold open · the desk at night/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause film" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(screen.getByText(/Scene 1 of 5 · The boundary decides first/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(6200);
    });
    expect(screen.getByText(/Scene 2 of 5 · Ten weighted factors/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(8400);
    });
    expect(screen.getByText(/Scene 3 of 5 · The room is chosen from every pair/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(8600);
    });
    expect(screen.getByText(/Scene 4 of 5 · The average hides the room/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(7400);
    });
    expect(screen.getByText(/Scene 5 of 5 · A person signs/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(7400);
    });
    expect(screen.getByText(/End card · same inputs, same rooms/i)).toBeInTheDocument();
    expect(screen.getByText(/Run RM-D1C916 · digest D1C9167C/i)).toBeInTheDocument();
  });

  it("pauses, resumes, and replays", () => {
    const { onReplay } = renderFilm();

    fireEvent.click(screen.getByRole("button", { name: "Pause film" }));
    expect(screen.getByRole("button", { name: "Play film" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText(/Cold open · the desk at night/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Play film" }));
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(screen.getByText(/Scene 1 of 5 · The boundary decides first/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Replay film" }));
    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Cold open · the desk at night/i)).toBeInTheDocument();
  });

  it("jumps to a chapter and pauses there", () => {
    renderFilm();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Chapter 3: The room is chosen from every pair/i,
      }),
    );

    expect(screen.getByText(/Scene 3 of 5/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play film" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Chapter 3: The room is chosen from every pair/i,
      }),
    ).toHaveAttribute("aria-current", "step");

    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(screen.getByText(/Scene 3 of 5/i)).toBeInTheDocument();
  });

  it("exposes the captions and their section links", () => {
    renderFilm();

    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(
      screen.getByText("Four boundaries. 96 students. 4 segments."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("4,560 possible pairs. 3,456 never compared. 1,104 scored."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /read the boundary section/i }),
    ).toHaveAttribute("href", "#boundary");

    fireEvent.click(
      screen.getByRole("button", { name: /Chapter 2: Ten weighted factors/i }),
    );
    expect(
      screen.getByText(/Missing answers renormalise; they are never guessed/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("S-035 × S-047 → 0.733."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /read the compatibility section/i }),
    ).toHaveAttribute("href", "#compatibility");

    fireEvent.click(
      screen.getByRole("button", { name: /Chapter 3: The room is chosen from every pair/i }),
    );
    expect(screen.getByText(/S-008 × S-021 · 0.808/i)).toBeInTheDocument();
    expect(screen.getByText(/considered, not chosen · S-008 is in R-02/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Chapter 4: The average hides the room/i }),
    );
    expect(
      screen.getByText(/The segment mean: 0.827. R-12: 0.416/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /read the fairness section/i }),
    ).toHaveAttribute("href", "#fairness");

    fireEvent.click(
      screen.getByRole("button", { name: /Chapter 5: A person signs/i }),
    );
    expect(
      screen.getByText(/96 notes. 38 rooms. 2 at risk. 3 passes. 0 new Poor/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /read the sign-off section/i }),
    ).toHaveAttribute("href", "#sign-off");
  });

  it("uses the stage keyboard for play/pause and escape", () => {
    renderFilm();
    const stage = screen.getByRole("group", { name: "Sample run film" });

    fireEvent.keyDown(stage, { key: " " });
    expect(screen.getByRole("button", { name: "Play film" })).toBeInTheDocument();

    fireEvent.keyDown(stage, { key: " " });
    expect(screen.getByRole("button", { name: "Pause film" })).toBeInTheDocument();

    fireEvent.keyDown(stage, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Play film" })).toBeInTheDocument();
  });

  it("renders all seven static panels under reduced motion without timers", () => {
    renderFilm(true);

    expect(vi.getTimerCount()).toBe(0);
    expect(screen.getByText(/Cold open · the desk at night/i)).toBeInTheDocument();
    expect(screen.getByText("Panel 1 of 7 · static")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous scene" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next scene" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Pause film" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next scene" }));
    expect(
      screen.getByText(/Scene 1 of 5 · The boundary decides first/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Panel 2 of 7 · static")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next scene" }));
    expect(screen.getByText(/Scene 2 of 5 · Ten weighted factors/i)).toBeInTheDocument();
    expect(screen.getByText("Panel 3 of 7 · static")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous scene" }));
    expect(
      screen.getByText(/Scene 1 of 5 · The boundary decides first/i),
    ).toBeInTheDocument();

    for (let step = 0; step < 5; step += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Next scene" }));
    }
    expect(screen.getByText(/End card · same inputs, same rooms/i)).toBeInTheDocument();
    expect(screen.getByText("Panel 7 of 7 · static")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next scene" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous scene" })).toBeEnabled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not auto-play when the document is hidden", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    renderFilm();

    expect(screen.getByText(/Cold open · the desk at night/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play film" })).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("pauses while the tab is hidden and resumes when it returns", () => {
    renderFilm();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByRole("button", { name: "Play film" })).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByRole("button", { name: "Pause film" })).toBeInTheDocument();
  });

  it("restarts from the cold open when the hero play key changes", () => {
    const onReplay = vi.fn();
    const view = render(
      <MemoryRouter>
        <SampleRunFilm run={run} playKey={0} onReplay={onReplay} />
      </MemoryRouter>,
    );

    act(() => {
      vi.advanceTimersByTime(2600);
    });
    act(() => {
      vi.advanceTimersByTime(6200);
    });
    act(() => {
      vi.advanceTimersByTime(8400);
    });
    expect(
      screen.getByText(/Scene 3 of 5 · The room is chosen from every pair/i),
    ).toBeInTheDocument();

    view.rerender(
      <MemoryRouter>
        <SampleRunFilm run={run} playKey={1} onReplay={onReplay} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Cold open · the desk at night/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause film" })).toBeInTheDocument();
  });
});
