import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeroRunStage } from "../../components/home/HeroRunStage";
import { run } from "../../components/home/simulate";

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (originalMatchMedia) {
    window.matchMedia = originalMatchMedia;
  }
  delete (document as unknown as { visibilityState?: string }).visibilityState;
});

describe("HeroRunStage", () => {
  it("starts an explicit replay even when motion is reduced", () => {
    const onReplay = vi.fn();
    const { rerender } = render(
      <HeroRunStage run={run} playKey={0} onReplay={onReplay} />,
    );

    expect(screen.getByText(/Run complete/i)).toBeInTheDocument();
    expect(screen.getByText(/Motion is reduced on this device/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /replay the sample run/i }));
    expect(onReplay).toHaveBeenCalledTimes(1);

    rerender(<HeroRunStage run={run} playKey={1} onReplay={onReplay} />);

    expect(screen.getByText(/Responses arriving/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText(/responses validated against the roster/i)).toBeInTheDocument();
  });
});
