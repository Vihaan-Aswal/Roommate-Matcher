// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearMotionMode,
  initMotion,
  resolveMotionMode,
  setMotionMode,
  type MotionMode,
} from "../../lib/motion";

interface MotionWindow {
  matchMedia?: (query: string) => {
    matches: boolean;
    addEventListener?: (type: string, listener: () => void) => void;
  };
  __setMotion?: (mode: MotionMode) => MotionMode;
  __clearMotion?: () => void;
}

const motionWindow = window as unknown as MotionWindow;

interface MediaStub {
  /** Flip the simulated system preference mid-test. */
  setMatches: (value: boolean) => void;
  /** Fire every change listener initMotion registered. */
  emit: () => void;
  registered: number;
}

function stubMatchMedia(initialMatches: boolean, withListener = true): MediaStub {
  let matches = initialMatches;
  const listeners: Array<() => void> = [];

  motionWindow.matchMedia = (query: string) => {
    expect(query).toBe("(prefers-reduced-motion: reduce)");
    return {
      get matches() {
        return matches;
      },
      ...(withListener
        ? {
            addEventListener: (_type: string, listener: () => void) => {
              listeners.push(listener);
            },
          }
        : {}),
    };
  };

  return {
    setMatches: (value: boolean) => {
      matches = value;
    },
    emit: () => {
      for (const listener of [...listeners]) listener();
    },
    get registered() {
      return listeners.length;
    },
  };
}

function motionEvents(): MotionMode[] {
  const seen: MotionMode[] = [];
  window.addEventListener("mm-motion-change", (event) => {
    seen.push((event as CustomEvent<MotionMode>).detail);
  });
  return seen;
}

beforeEach(() => {
  // setup.ts pins the suite to "off"; each test starts from a clean slate.
  delete document.documentElement.dataset.motion;
  window.localStorage.clear();
  delete motionWindow.matchMedia;
  delete motionWindow.__setMotion;
  delete motionWindow.__clearMotion;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.motion;
  window.localStorage.clear();
  delete motionWindow.matchMedia;
});

describe("resolveMotionMode", () => {
  it("trusts a valid data-motion attribute on the document", () => {
    document.documentElement.dataset.motion = "reduced";

    expect(resolveMotionMode()).toBe("reduced");
  });

  it("ignores an invalid attribute and uses the stored choice", () => {
    document.documentElement.dataset.motion = "loud";
    window.localStorage.setItem("mm-motion", "off");

    expect(resolveMotionMode()).toBe("off");
  });

  it("ignores a stored value that is not a motion mode", () => {
    window.localStorage.setItem("mm-motion", "blur");

    expect(resolveMotionMode()).toBe("full");
  });

  it("follows the system reduced-motion preference when nothing is stored", () => {
    stubMatchMedia(true);

    expect(resolveMotionMode()).toBe("reduced");
  });

  it("stays on full when the system does not ask for reduced motion", () => {
    stubMatchMedia(false);

    expect(resolveMotionMode()).toBe("full");
  });

  it("stays on full when matchMedia does not exist", () => {
    expect(resolveMotionMode()).toBe("full");
  });

  it("treats blocked storage as no stored choice", () => {
    window.localStorage.setItem("mm-motion", "off");
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    try {
      // Prove the mock is live before trusting the fallback result below.
      expect(() => window.localStorage.getItem("mm-motion")).toThrow("storage blocked");

      expect(resolveMotionMode()).toBe("full");
    } finally {
      getItem.mockRestore();
    }
  });
});

describe("setMotionMode", () => {
  it("applies, persists and announces the mode", () => {
    const seen = motionEvents();

    const result = setMotionMode("reduced");

    expect(result).toBe("reduced");
    expect(document.documentElement.dataset.motion).toBe("reduced");
    expect(window.localStorage.getItem("mm-motion")).toBe("reduced");
    expect(seen).toEqual(["reduced"]);
  });

  it("still applies the mode when storage cannot be written", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    const seen = motionEvents();

    try {
      expect(() => window.localStorage.setItem("probe", "1")).toThrow("quota exceeded");

      expect(() => setMotionMode("off")).not.toThrow();
    } finally {
      setItem.mockRestore();
    }

    expect(document.documentElement.dataset.motion).toBe("off");
    expect(window.localStorage.getItem("mm-motion")).toBeNull();
    expect(seen).toEqual(["off"]);
  });
});

describe("clearMotionMode", () => {
  it("forgets the manual choice and falls back to the system preference", () => {
    stubMatchMedia(false);
    setMotionMode("off");
    const seen = motionEvents();

    clearMotionMode();

    expect(window.localStorage.getItem("mm-motion")).toBeNull();
    expect(document.documentElement.dataset.motion).toBe("full");
    expect(seen).toEqual(["full"]);
  });

  it("falls back to reduced when the system asks for it", () => {
    stubMatchMedia(true);
    setMotionMode("full");

    clearMotionMode();

    expect(document.documentElement.dataset.motion).toBe("reduced");
  });

  it("still clears the attribute when storage cannot be written", () => {
    window.localStorage.setItem("mm-motion", "off");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    try {
      expect(() => window.localStorage.removeItem("mm-motion")).toThrow("storage blocked");

      expect(() => clearMotionMode()).not.toThrow();
    } finally {
      removeItem.mockRestore();
    }

    // The failed removal leaves the stored choice in place, so it still applies.
    expect(window.localStorage.getItem("mm-motion")).toBe("off");
    expect(document.documentElement.dataset.motion).toBe("off");
  });
});

describe("initMotion", () => {
  it("applies the stored mode before the first paint", () => {
    window.localStorage.setItem("mm-motion", "reduced");
    const media = stubMatchMedia(false);

    initMotion();

    expect(document.documentElement.dataset.motion).toBe("reduced");
    expect(media.registered).toBe(1);
  });

  it("exposes the manual switch and the clear switch on window", () => {
    stubMatchMedia(false);
    initMotion();

    const setMotion = motionWindow.__setMotion;
    const clearMotion = motionWindow.__clearMotion;
    expect(typeof setMotion).toBe("function");
    expect(typeof clearMotion).toBe("function");

    expect(setMotion?.("off")).toBe("off");
    expect(document.documentElement.dataset.motion).toBe("off");
    expect(window.localStorage.getItem("mm-motion")).toBe("off");

    clearMotion?.();
    expect(document.documentElement.dataset.motion).toBe("full");
    expect(window.localStorage.getItem("mm-motion")).toBeNull();
  });

  it("follows the system when the preference changes and no manual choice is stored", () => {
    const media = stubMatchMedia(false);
    initMotion();
    const seen = motionEvents();

    media.setMatches(true);
    media.emit();

    expect(document.documentElement.dataset.motion).toBe("reduced");
    expect(seen).toEqual(["reduced"]);
  });

  it("does not let the system override a manual choice", () => {
    window.localStorage.setItem("mm-motion", "off");
    const media = stubMatchMedia(true);
    initMotion();
    const seen = motionEvents();

    media.emit();

    expect(document.documentElement.dataset.motion).toBe("off");
    expect(seen).toEqual([]);
  });

  it("works when the media query cannot report changes", () => {
    stubMatchMedia(false, false);

    expect(() => initMotion()).not.toThrow();

    expect(document.documentElement.dataset.motion).toBe("full");
  });

  it("works when matchMedia is unavailable", () => {
    expect(() => initMotion()).not.toThrow();

    expect(document.documentElement.dataset.motion).toBe("full");
  });
});
