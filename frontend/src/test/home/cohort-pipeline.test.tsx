import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CohortPipeline } from "../../components/home/CohortPipeline";
import { run } from "../../components/home/simulate";

const originalMatchMedia = window.matchMedia;

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

interface FramePump {
  advance: (milliseconds: number) => void;
}

function installFrames(): FramePump {
  let clock = 0;
  let pending: FrameRequestCallback | null = null;

  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    pending = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    pending = null;
  });

  return {
    advance(milliseconds: number) {
      const steps = Math.max(0, Math.round(milliseconds / 16));
      act(() => {
        for (let step = 0; step < steps; step += 1) {
          const callback = pending;
          if (!callback) return;
          pending = null;
          clock += 16;
          callback(clock);
        }
      });
    },
  };
}

function renderPipeline() {
  const view = render(
    <MemoryRouter>
      <CohortPipeline run={run} playKey={0} />
    </MemoryRouter>,
  );
  return view;
}

function timecode(): string {
  return document.querySelector(".cp-timecode")?.textContent ?? "";
}

let frames: FramePump;

beforeEach(() => {
  frames = installFrames();
  setReducedMotion(false);
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

describe("CohortPipeline", () => {
  it("starts on mount and advances through the four beats", () => {
    renderPipeline();

    expect(screen.getByText("A roster, a room list, a private form.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause pipeline" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Cohort pipeline animation" })).toHaveAttribute(
      "data-step",
      "1",
    );

    frames.advance(3000);
    expect(
      screen.getByText("Students answer once. Raw answers stay sealed."),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Cohort pipeline animation" })).toHaveAttribute(
      "data-step",
      "2",
    );
    expect(timecode()).toMatch(/00:03\.\d/);

    frames.advance(3000);
    expect(
      screen.getByText("Four boundaries decide who can be compared."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("4,560 possible pairs → 3,456 never compared → 1,104 scored."),
    ).toBeInTheDocument();

    frames.advance(3500);
    expect(
      screen.getByText("Every eligible pair is scored on ten weighted factors."),
    ).toBeInTheDocument();
    expect(screen.getByText("0.416")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Cohort pipeline animation" })).toHaveAttribute(
      "data-step",
      "4",
    );

    frames.advance(1000);
    expect(screen.getByText("End of take")).toBeInTheDocument();
  });

  it("pauses, resumes, seeks and replays", () => {
    renderPipeline();

    fireEvent.click(screen.getByRole("button", { name: "Pause pipeline" }));
    expect(screen.getByRole("button", { name: "Play pipeline" })).toBeInTheDocument();
    const pausedAt = timecode();

    frames.advance(2000);
    expect(timecode()).toBe(pausedAt);

    fireEvent.click(screen.getByRole("button", { name: "Play pipeline" }));
    frames.advance(500);
    expect(timecode()).not.toBe(pausedAt);

    fireEvent.click(screen.getByRole("button", { name: "Step 3: Boundaries" }));
    expect(
      screen.getByText("Four boundaries decide who can be compared."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play pipeline" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Replay pipeline" }));
    expect(timecode()).toBe("00:00.0 / 00:10");
    expect(screen.getByRole("button", { name: "Pause pipeline" })).toBeInTheDocument();
  });

  it("seeks with the slider and the stage keyboard", () => {
    renderPipeline();
    const slider = screen.getByRole("slider", { name: "Pipeline position" });

    fireEvent.change(slider, { target: { value: "7.5" } });
    expect(
      screen.getByText("Four boundaries decide who can be compared."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play pipeline" })).toBeInTheDocument();

    const stage = screen.getByRole("group", { name: "Cohort pipeline animation" });
    fireEvent.keyDown(stage, { key: " " });
    expect(screen.getByRole("button", { name: "Pause pipeline" })).toBeInTheDocument();
    fireEvent.keyDown(stage, { key: " " });
    expect(screen.getByRole("button", { name: "Play pipeline" })).toBeInTheDocument();

    fireEvent.keyDown(stage, { key: "ArrowRight" });
    expect(timecode()).toMatch(/00:0[78]\.\d/);
  });

  it("disables the stations that are not in this preview", () => {
    renderPipeline();

    expect(
      screen.getByRole("button", { name: /Step 5: Match \(not in this preview\)/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Step 8: Sign-off \(not in this preview\)/ }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Step 1: Inputs" })).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("runs with reduced motion reported, and never shows a static fallback", () => {
    setReducedMotion(true);
    renderPipeline();

    expect(screen.getByRole("button", { name: "Pause pipeline" })).toBeInTheDocument();
    frames.advance(1500);
    expect(timecode()).not.toBe("00:00.0 / 00:10");
    expect(screen.getByRole("slider", { name: "Pipeline position" })).toBeInTheDocument();
  });

  it("does not autoplay hidden, pauses on hide and resumes on return", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    renderPipeline();
    expect(screen.getByRole("button", { name: "Play pipeline" })).toBeInTheDocument();
    expect(timecode()).toBe("00:00.0 / 00:10");

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByRole("button", { name: "Pause pipeline" })).toBeInTheDocument();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByRole("button", { name: "Play pipeline" })).toBeInTheDocument();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByRole("button", { name: "Pause pipeline" })).toBeInTheDocument();
  });

  it("keeps the moving stage out of the accessibility tree and the caption in it", () => {
    const { container } = renderPipeline();
    const stage = screen.getByRole("group", { name: "Cohort pipeline animation" });
    expect(stage.querySelector(".cp-world")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".cp-caption")).toHaveAttribute("aria-live", "polite");
    expect(
      screen.getByText(/Illustrative sample data\. 96 students, 38 rooms/),
    ).toBeInTheDocument();
  });
});
