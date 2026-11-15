import "@testing-library/jest-dom/vitest";

// The global motion kill switch: tests never wait on an animation or a frame.
// `app/motion.css` reads this attribute, so every animation and transition in the
// product is off for the whole unit suite.
document.documentElement.dataset.motion = "off";
