/**
 * motion.ts — the product's single motion switch.
 *
 * Modes:
 *   full     — the app is alive (default)
 *   reduced  — no movement; state changes are instant (system preference or manual)
 *   off      — nothing animates at all; used by the test setup and available to
 *              anyone who wants a still product
 *
 * The manual choice is persisted in localStorage and mirrored onto
 * `<html data-motion>`, which `app/motion.css` reads. The system preference is
 * honoured by CSS on its own; this module only decides the manual override.
 */

export type MotionMode = "full" | "reduced" | "off";

const STORAGE_KEY = "mm-motion";
const CHANGE_EVENT = "mm-motion-change";

function isMode(value: unknown): value is MotionMode {
  return value === "full" || value === "reduced" || value === "off";
}

function readStoredMode(): MotionMode | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isMode(stored) ? stored : null;
  } catch {
    return null;
  }
}

function systemPrefersReduced(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The mode the document should be in right now. */
export function resolveMotionMode(): MotionMode {
  if (typeof document === "undefined") return "full";
  const attribute = document.documentElement.dataset.motion;
  if (isMode(attribute)) return attribute;
  const stored = readStoredMode();
  if (stored) return stored;
  return systemPrefersReduced() ? "reduced" : "full";
}

/** Set the mode for this browser and mirror it onto the document. */
export function setMotionMode(mode: MotionMode): MotionMode {
  if (typeof document === "undefined") return mode;
  document.documentElement.dataset.motion = mode;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Private mode or a blocked storage: the attribute still applies.
  }
  window.dispatchEvent(new CustomEvent<MotionMode>(CHANGE_EVENT, { detail: mode }));
  return mode;
}

/** Forget the manual choice and fall back to the system preference. */
export function clearMotionMode(): void {
  if (typeof document === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  delete document.documentElement.dataset.motion;
  const resolved = resolveMotionMode();
  document.documentElement.dataset.motion = resolved;
  window.dispatchEvent(new CustomEvent<MotionMode>(CHANGE_EVENT, { detail: resolved }));
}

/**
 * Called once from the app entry, before render: applies the stored choice so the
 * very first paint is already in the right mode, and exposes the manual switch
 * (`window.__setMotion("off" | "reduced" | "full")`) for a person at a keyboard.
 */
export function initMotion(): void {
  if (typeof document === "undefined") return;
  const mode = resolveMotionMode();
  document.documentElement.dataset.motion = mode;

  (window as unknown as { __setMotion?: (mode: MotionMode) => MotionMode }).__setMotion = (next) =>
    setMotionMode(next);
  (window as unknown as { __clearMotion?: () => void }).__clearMotion = () => clearMotionMode();

  if (typeof window.matchMedia === "function") {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Only follow the system when no manual choice is stored.
    query.addEventListener?.("change", () => {
      if (!readStoredMode()) {
        document.documentElement.dataset.motion = systemPrefersReduced() ? "reduced" : "full";
        window.dispatchEvent(
          new CustomEvent<MotionMode>(CHANGE_EVENT, { detail: resolveMotionMode() }),
        );
      }
    });
  }
}
