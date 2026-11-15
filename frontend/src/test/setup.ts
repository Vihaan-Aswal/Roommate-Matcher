export {};

// Node-environment tests (pure libs) do not need jest-dom or a DOM flag.
if (typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");

  // Unit tests never touch the network. Any accidental fetch fails loudly
  // instead of reaching a dev server or timing out against a closed port.
  globalThis.fetch = (() =>
    Promise.reject(new Error("network disabled in unit tests"))) as typeof fetch;

  // The global motion kill switch: tests never wait on an animation or a frame.
  // `app/motion.css` reads this attribute, so every animation and transition in the
  // product is off for the whole unit suite.
  document.documentElement.dataset.motion = "off";
}
