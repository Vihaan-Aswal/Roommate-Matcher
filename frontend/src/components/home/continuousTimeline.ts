/**
 * The continuous sample-run film's timeline.
 *
 * Pure data and interpolation: the camera path, the captions and the few
 * material beats. The component owns the playhead and writes the result to the
 * DOM; nothing here depends on React or the browser.
 */

export const FILM_DURATION = 10;
export const MOBILE_BREAKPOINT = 767;

export interface CameraFrame {
  at: number;
  x: number;
  y: number;
  scale: number;
}

export interface CameraPosition {
  x: number;
  y: number;
  scale: number;
}

/**
 * Focus points and scale, in fractions of the desk world. The world is 100%
 * wide on every viewport; 135% tall on portrait, which is what gives the
 * mobile camera somewhere to travel.
 *
 * The 2.6–8.4s frame is the evidence frame: the boundary ledger, the four
 * folders and the pair ledger are all fully inside it. The roster and envelope
 * are fully outside it. At 9.4s the camera pulls back to the whole desk, where
 * every object is inside again. No paused beat cuts a number or a slip.
 */
export const DESKTOP_CAMERA: CameraFrame[] = [
  { at: 0, x: 0.5, y: 0.5, scale: 1 },
  { at: 1.4, x: 0.5, y: 0.5, scale: 1.02 },
  { at: 2.6, x: 0.615, y: 0.476, scale: 1.33 },
  { at: 5.2, x: 0.615, y: 0.476, scale: 1.34 },
  { at: 6.8, x: 0.615, y: 0.476, scale: 1.35 },
  { at: 8.1, x: 0.615, y: 0.476, scale: 1.35 },
  { at: 8.4, x: 0.615, y: 0.476, scale: 1.35 },
  { at: 9.4, x: 0.5, y: 0.5, scale: 1 },
  { at: 10, x: 0.5, y: 0.5, scale: 1 },
];

export const MOBILE_CAMERA: CameraFrame[] = [
  { at: 0, x: 0.5, y: 0.38, scale: 1 },
  { at: 1.8, x: 0.5, y: 0.4, scale: 1 },
  { at: 2.6, x: 0.5, y: 0.615, scale: 1 },
  { at: 5.2, x: 0.5, y: 0.625, scale: 1 },
  { at: 8.4, x: 0.5, y: 0.625, scale: 1 },
  { at: 10, x: 0.5, y: 0.625, scale: 1 },
];

export interface FilmCaption {
  at: number;
  label: string;
  kicker: string;
  line: string;
  sub: string;
}

export const CAPTIONS: FilmCaption[] = [
  {
    at: 0,
    label: "Open",
    kicker: "The desk at night",
    line: "96 responses. 38 rooms. One desk.",
    sub: "Illustrative sample run.",
  },
  {
    at: 2.6,
    label: "Boundary",
    kicker: "The boundary decides first",
    line: "4,560 possible pairs → 1,104 scored.",
    sub: "3,456 never compared.",
  },
  {
    at: 5.2,
    label: "R-12",
    kicker: "Ten weighted factors · R-12",
    line: "S-009 × S-021 — 0.416.",
    sub: "Three zeros. One blank answer; weights renormalise.",
  },
  {
    at: 7.8,
    label: "R-15",
    kicker: "Ten weighted factors · R-15",
    line: "S-035 × S-047 — 0.733.",
    sub: "Same rules. The desk proposes; a person signs.",
  },
];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeInOutCubic(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

/** A camera that eases between focus points and never jumps. */
export function cameraAt(time: number, frames: CameraFrame[]): CameraPosition {
  const t = Math.min(FILM_DURATION, Math.max(0, time));
  let next = 1;
  while (next < frames.length && frames[next].at < t) next += 1;
  if (next >= frames.length) return { ...frames[frames.length - 1] };
  const from = frames[next - 1];
  const to = frames[next];
  const span = to.at - from.at;
  const local = span === 0 ? 1 : (t - from.at) / span;
  const eased = easeInOutCubic(clamp01(local));
  return {
    x: lerp(from.x, to.x, eased),
    y: lerp(from.y, to.y, eased),
    scale: lerp(from.scale, to.scale, eased),
  };
}

export function captionIndexAt(time: number): number {
  let index = 0;
  for (let i = 0; i < CAPTIONS.length; i += 1) {
    if (time >= CAPTIONS[i].at) index = i;
  }
  return index;
}

export function lampAt(time: number): number {
  const t = clamp01(time / 1.4);
  return 0.22 + 0.78 * (1 - Math.pow(1 - t, 3));
}

/** The thread draws from the sealed responses, through the folders, to the ledger. */
export function threadAt(time: number): number {
  return easeInOutCubic(clamp01((time - 0.7) / 7.6));
}

/** The factor bars draw during the boundary close; settled by the R-12 mark. */
export function factorRevealAt(time: number): number {
  return easeInOutCubic(clamp01((time - 4.0) / 1.2));
}

export function scorePressAt(time: number, at: number, duration = 0.3): number {
  return easeInOutCubic(clamp01((time - at) / duration));
}

export function formatFilmTime(time: number): string {
  const t = Math.min(FILM_DURATION, Math.max(0, time));
  return `00:${t.toFixed(1).padStart(4, "0")}`;
}

export function formatMarker(time: number): string {
  return `0:${String(Math.round(time)).padStart(2, "0")}`;
}
