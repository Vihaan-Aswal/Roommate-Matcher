/**
 * Timeline for the cohort-pipeline explainer spike.
 *
 * Pure sampling: camera position, station fades and the local paper beats.
 * The component owns the playhead and writes these numbers to the DOM. No
 * browser or React dependency belongs here.
 */

export const PIPELINE_DURATION = 10;

export interface PipelineStep {
  id: string;
  label: string;
  /** Start time in this phase; null for steps not built yet. */
  at: number | null;
  /** A settled frame for rail seeking; null for steps not built yet. */
  seekAt: number | null;
  caption: string;
  detail: string;
}

export const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "inputs",
    label: "Inputs",
    at: 0,
    seekAt: 0,
    caption: "A roster, a room list, a private form.",
    detail: "96 students · 38 rooms · 12 questions.",
  },
  {
    id: "form",
    label: "Form",
    at: 2.5,
    seekAt: 2.6,
    caption: "Students answer once. Raw answers stay sealed.",
    detail: "96 responses in · 10 weighted factors out.",
  },
  {
    id: "boundaries",
    label: "Boundaries",
    at: 5.5,
    seekAt: 5.6,
    caption: "Four boundaries decide who can be compared.",
    detail: "4,560 possible pairs → 3,456 never compared → 1,104 scored.",
  },
  {
    id: "score",
    label: "Score",
    at: 9,
    seekAt: 9.6,
    caption: "Every eligible pair is scored on ten weighted factors.",
    detail: "Missing answers are excluded; the remaining weights renormalise.",
  },
  {
    id: "match",
    label: "Match",
    at: null,
    seekAt: null,
    caption: "The matcher chooses rooms from all pairs.",
    detail: "2-bed maximum weight · 3-bed seed and grow · 4-bed pair then merge.",
  },
  {
    id: "fairness",
    label: "Fairness",
    at: null,
    seekAt: null,
    caption: "The average hides the room. The fairness statement puts it first.",
    detail: "Swap pass: 3 passes · 3 accepted · 0 new Poor.",
  },
  {
    id: "documents",
    label: "Documents",
    at: null,
    seekAt: null,
    caption: "Reasons, never raw answers.",
    detail: "Assignments, reasons, fairness and audit · 96 notes.",
  },
  {
    id: "signoff",
    label: "Sign-off",
    at: null,
    seekAt: null,
    caption: "A person signs before keys are issued.",
    detail: "The proposal waits for a signature.",
  },
];

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeInOutCubic(value: number): number {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function holdThenMove(
  time: number,
  holdUntil: number,
  arriveAt: number,
  from: number,
  to: number,
): number {
  if (time <= holdUntil) return from;
  if (time >= arriveAt) return to;
  return lerp(from, to, easeInOutCubic((time - holdUntil) / (arriveAt - holdUntil)));
}

/** Camera position in station units: 0 Inputs, 1 Form, 2 Boundaries, 3 Score. */
export function cameraAt(time: number): number {
  const t = Math.min(PIPELINE_DURATION, Math.max(0, time));
  if (t < 2.5) return holdThenMove(t, 2.15, 2.5, 0, 1);
  if (t < 5.5) return holdThenMove(t, 5.15, 5.5, 1, 2);
  return holdThenMove(t, 9.0, 9.4, 2, 3);
}

/** The step the caption and rail call current. Score is current from 9.0. */
export function stepIndexAt(time: number): number {
  const t = Math.min(PIPELINE_DURATION, Math.max(0, time));
  if (t < 2.5) return 0;
  if (t < 5.5) return 1;
  if (t < 9) return 2;
  return 3;
}

/**
 * Station content is fully out before the camera moves and fully in after it
 * arrives. That is the rule that keeps every number either wholly framed or
 * wholly gone.
 */
export function stationOpacityAt(time: number, index: number): number {
  const t = Math.min(PIPELINE_DURATION, Math.max(0, time));
  if (index === 0) return 1 - clamp01((t - 2) / 0.14);
  if (index === 1) {
    if (t < 5) return clamp01((t - 2.5) / 0.14);
    return 1 - clamp01((t - 5) / 0.14);
  }
  if (index === 2) {
    if (t < 8.8) return clamp01((t - 5.5) / 0.14);
    return 1 - clamp01((t - 8.8) / 0.14);
  }
  return clamp01((t - 9.4) / 0.08);
}

/** 0..1 entrance for the intake papers. */
export function inputsRevealAt(time: number): number {
  return easeInOutCubic((time - 0.06) / 0.49);
}

/** 0..1 entrance for the persistent cohort pack. */
export function batchAt(time: number): number {
  return easeInOutCubic(time / 0.55);
}

/** 0..1 while the camera is between stations; used for a small carry lift. */
export function travelAt(time: number): number {
  const windows: Array<[number, number]> = [
    [2.15, 2.5],
    [5.15, 5.5],
    [9, 9.4],
  ];
  for (const [start, end] of windows) {
    if (time >= start && time <= end) {
      return Math.sin(Math.PI * clamp01((time - start) / (end - start)));
    }
  }
  return 0;
}

/** 0..1 arrival of the 96 response cards. */
export function cardArrivalAt(time: number): number {
  return clamp01((time - 2.62) / 1.42);
}

/** 0..1 wax seal on the raw-answer envelope. */
export function sealAt(time: number): number {
  return easeInOutCubic((time - 4.04) / 0.32);
}

/** 0..1 normalised-preference slip leaving the sealed envelope. */
export function normalisedAt(time: number): number {
  return easeInOutCubic((time - 4.42) / 0.55);
}

/** 0..1 press for boundary stamp i. */
export function stampAt(time: number, index: number): number {
  return easeInOutCubic((time - (5.66 + index * 0.28)) / 0.22);
}

/** 0..1 rise of the four segment folders. */
export function foldersAt(time: number): number {
  return easeInOutCubic((time - 6.48) / 0.42);
}

/** 0..1 pair ledger reveal, fully settled before the 7-second frame. */
export function ledgerAt(time: number): number {
  return easeInOutCubic((time - 6.66) / 0.3);
}

/** 0..1 opening of the R-12 folder. */
export function openAt(time: number): number {
  return easeInOutCubic((time - 7.4) / 0.45);
}

export function formatFilmTime(time: number): string {
  const t = Math.min(PIPELINE_DURATION, Math.max(0, time));
  return `00:${t.toFixed(1).padStart(4, "0")}`;
}
