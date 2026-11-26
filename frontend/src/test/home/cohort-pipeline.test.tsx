import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
  it("starts on mount and advances through all eight stations", () => {
    renderPipeline();

    expect(screen.getByText("A roster, a room list, a private form.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause pipeline" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Cohort pipeline animation" })).toHaveAttribute(
      "data-step",
      "1",
    );

    frames.advance(5200);
    expect(
      screen.getByText("Students answer once. Raw answers stay sealed."),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Cohort pipeline animation" })).toHaveAttribute(
      "data-step",
      "2",
    );
    expect(timecode()).toMatch(/00:05\.\d/);

    frames.advance(5200);
    expect(
      screen.getByText("Four boundaries decide who can be compared."),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Cohort pipeline animation" })).toHaveAttribute(
      "data-step",
      "3",
    );

    const slider = screen.getByRole("slider", { name: "Pipeline position" });
    const stage = screen.getByRole("group", { name: "Cohort pipeline animation" });

    fireEvent.change(slider, { target: { value: "13" } });
    const boundaries = document.querySelector('[data-station="boundaries"]') as HTMLElement;
    expect(within(boundaries).getByText("4,560")).toBeInTheDocument();
    expect(within(boundaries).getByText("3,456")).toBeInTheDocument();
    expect(within(boundaries).getByText("1,104")).toBeInTheDocument();
    expect(within(boundaries).getByText("Open · R-12 · 12 rooms")).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: "19" } });
    const score = document.querySelector('[data-station="score"]') as HTMLElement;
    expect(
      screen.getByText(
        "Three zeros and one blank answer. The remaining weights renormalise.",
      ),
    ).toBeInTheDocument();
    expect(within(score).getByText("0.416")).toBeInTheDocument();
    expect(
      within(score).getByText("Bar = raw factor score · weights are effective."),
    ).toBeInTheDocument();
    expect(score.querySelectorAll(".cp-factor.is-zero")).toHaveLength(3);
    expect(score.querySelectorAll(".cp-factor.is-missing")).toHaveLength(1);
    expect(score.querySelectorAll(".cp-factor-score b")).toHaveLength(10);
    expect(within(score).getByText("0.25")).toBeInTheDocument();
    expect(stage).toHaveAttribute("data-step", "4");

    fireEvent.change(slider, { target: { value: "26.5" } });
    const match = document.querySelector('[data-station="match"]') as HTMLElement;
    expect(within(match).getByText("38")).toBeInTheDocument();
    expect(within(match).getByText("2-bed · two segments")).toBeInTheDocument();
    expect(within(match).getByText("3-bed · one segment")).toBeInTheDocument();
    expect(within(match).getByText("4-bed · one segment")).toBeInTheDocument();
    expect(within(match).getByText("24 + 8 + 6 = 38 rooms")).toBeInTheDocument();
    expect(within(match).getByText("R-12")).toBeInTheDocument();
    expect(stage).toHaveAttribute("data-step", "5");

    fireEvent.change(slider, { target: { value: "34" } });
    const fairness = document.querySelector('[data-station="fairness"]') as HTMLElement;
    expect(within(fairness).getByText("2 at risk · review required")).toBeInTheDocument();
    expect(within(fairness).getAllByText("0.416").length).toBeGreaterThan(1);
    expect(within(fairness).getAllByText("mean 0.827").length).toBeGreaterThan(0);
    expect(within(fairness).getAllByText("3").length).toBeGreaterThan(1);
    expect(within(fairness).getByText("0")).toBeInTheDocument();
    expect(stage).toHaveAttribute("data-step", "6");

    fireEvent.change(slider, { target: { value: "40.5" } });
    const documents = document.querySelector('[data-station="documents"]') as HTMLElement;
    expect(within(documents).getByText("96")).toBeInTheDocument();
    expect(within(documents).getByText("RM-D1C916")).toBeInTheDocument();
    expect(within(documents).getByText(/D1C9167C/)).toBeInTheDocument();
    expect(stage).toHaveAttribute("data-step", "7");

    fireEvent.change(slider, { target: { value: "47.5" } });
    const signoff = document.querySelector('[data-station="signoff"]') as HTMLElement;
    expect(within(signoff).getByText("38 rooms · 96 beds")).toBeInTheDocument();
    expect(within(signoff).getByText("2 · R-12 · review required")).toBeInTheDocument();
    expect(within(signoff).getByText("Signed by a person")).toBeInTheDocument();
    expect(within(signoff).getByText("After the signature")).toBeInTheDocument();
    expect(within(signoff).getByText("0.416")).toBeInTheDocument();
    expect(stage).toHaveAttribute("data-step", "8");

    fireEvent.change(slider, { target: { value: "50" } });
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

    fireEvent.click(screen.getByRole("button", { name: "06 Fairness · step 6 of 8" }));
    expect(
      screen.getByText("The average hides the room. The fairness statement puts it first."),
    ).toBeInTheDocument();
    expect(timecode()).toBe("00:34.0 / 00:50");
    expect(screen.getByRole("button", { name: "Play pipeline" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Replay pipeline" }));
    expect(timecode()).toBe("00:00.0 / 00:50");
    expect(screen.getByRole("button", { name: "Pause pipeline" })).toBeInTheDocument();
  });

  it("seeks with the slider and the stage keyboard", () => {
    renderPipeline();
    const slider = screen.getByRole("slider", { name: "Pipeline position" });

    fireEvent.change(slider, { target: { value: "26.5" } });
    expect(
      screen.getByText("Every pair is considered; each room size gets its own strategy."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play pipeline" })).toBeInTheDocument();

    const stage = screen.getByRole("group", { name: "Cohort pipeline animation" });
    fireEvent.keyDown(stage, { key: " " });
    expect(screen.getByRole("button", { name: "Pause pipeline" })).toBeInTheDocument();
    fireEvent.keyDown(stage, { key: " " });
    expect(screen.getByRole("button", { name: "Play pipeline" })).toBeInTheDocument();

    fireEvent.keyDown(stage, { key: "ArrowRight" });
    expect(timecode()).toMatch(/00:2[67]\.\d/);
  });

  it("makes every station reachable from the rail", () => {
    renderPipeline();

    expect(
      screen.getByRole("button", { name: "05 Match · step 5 of 8" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "08 Sign-off · step 8 of 8" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "01 Inputs · step 1 of 8" }),
    ).toHaveAttribute("aria-current", "step");

    fireEvent.click(
      screen.getByRole("button", { name: "08 Sign-off · step 8 of 8" }),
    );
    expect(timecode()).toBe("00:47.0 / 00:50");
    expect(
      screen.getByText("A person signs before keys are issued."),
    ).toBeInTheDocument();
  });

  it("runs with reduced motion reported, and never shows a static fallback", () => {
    setReducedMotion(true);
    renderPipeline();

    expect(screen.getByRole("button", { name: "Pause pipeline" })).toBeInTheDocument();
    frames.advance(1500);
    expect(timecode()).not.toBe("00:00.0 / 00:50");
    expect(screen.getByRole("slider", { name: "Pipeline position" })).toBeInTheDocument();
  });

  it("does not autoplay hidden, pauses on hide and resumes on return", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    renderPipeline();
    expect(screen.getByRole("button", { name: "Play pipeline" })).toBeInTheDocument();
    expect(timecode()).toBe("00:00.0 / 00:50");

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
