/**
 * Timeline for the full cohort-pipeline explainer.
 *
 * Pure sampling: camera position, station fades and the local paper beats.
 * The component owns the playhead and writes these numbers to the DOM. No
 * browser or React dependency belongs here.
 */

export const PIPELINE_DURATION = 50;

export const STATION_STARTS = [0, 4.5, 10, 16.5, 23.5, 31, 38.5, 44] as const;
export const STATION_LEAVES = [4.1, 9.6, 16.1, 23.1, 30.6, 38.1, 43.6, 50] as const;

export interface PipelineStep {
  id: string;
  label: string;
  /** Arrival time in this take. */
  at: number;
  /** A settled frame for rail seeking. */
  seekAt: number;
  caption: string;
  detail: string;
}

export const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "inputs",
    label: "Inputs",
    at: 0,
    seekAt: 1.5,
    caption: "A roster, a room list, a private form.",
    detail: "96 students · 38 rooms · 12 questions.",
  },
  {
    id: "form",
    label: "Form",
    at: 4.5,
    seekAt: 7.5,
    caption: "Students answer once. Raw answers stay sealed.",
    detail: "96 responses in · 10 weighted factors out.",
  },
  {
    id: "boundaries",
    label: "Boundaries",
    at: 10,
    seekAt: 13,
    caption: "Four boundaries decide who can be compared.",
    detail: "4,560 possible pairs → 3,456 never compared → 1,104 scored.",
  },
  {
    id: "score",
    label: "Score",
    at: 16.5,
    seekAt: 19,
    caption: "Every eligible pair is scored on ten weighted factors.",
    detail: "Three zeros and one blank answer. The remaining weights renormalise.",
  },
  {
    id: "match",
    label: "Match",
    at: 23.5,
    seekAt: 26.5,
    caption: "Every pair is considered; each room size gets its own strategy.",
    detail: "2-bed maximum weight · 3-bed seed and grow · 4-bed pair then merge · 38 rooms.",
  },
  {
    id: "fairness",
    label: "Fairness",
    at: 31,
    seekAt: 34,
    caption: "The average hides the room. The fairness statement puts it first.",
    detail: "Segment mean 0.827 · R-12 0.416 · 2 at risk below 0.55.",
  },
  {
    id: "documents",
    label: "Documents",
    at: 38.5,
    seekAt: 40.5,
    caption: "Reasons, never raw answers.",
    detail: "Assignments, reasons, fairness and audit · 96 notes.",
  },
  {
    id: "signoff",
    label: "Sign-off",
    at: 44,
    seekAt: 47,
    caption: "A person signs before keys are issued.",
    detail: "Proposal · 38 rooms · 96 beds · floor 0.416.",
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

/** Camera position in station units: 0 Inputs … 7 Sign-off. */
export function cameraAt(time: number): number {
  const t = Math.min(PIPELINE_DURATION, Math.max(0, time));
  for (let index = 0; index < STATION_LEAVES.length - 1; index += 1) {
    const leave = STATION_LEAVES[index];
    const arrive = STATION_STARTS[index + 1];
    if (t < arrive) {
      return holdThenMove(t, leave, arrive, index, index + 1);
    }
  }
  return STATION_STARTS.length - 1;
}

/** The step the caption and rail call current. */
export function stepIndexAt(time: number): number {
  const t = Math.min(PIPELINE_DURATION, Math.max(0, time));
  for (let index = STATION_STARTS.length - 1; index >= 0; index -= 1) {
    if (t >= STATION_STARTS[index]) return index;
  }
  return 0;
}

/**
 * Station content is fully out before the camera moves and fully in after it
 * arrives. That is the rule that keeps every number either wholly framed or
 * wholly gone.
 */
export function stationOpacityAt(time: number, index: number): number {
  const t = Math.min(PIPELINE_DURATION, Math.max(0, time));
  const start = STATION_STARTS[index];
  const leave = STATION_LEAVES[index];
  if (index === 0) return 1 - clamp01((t - (leave - 0.14)) / 0.14);
  if (index === STATION_STARTS.length - 1) return clamp01((t - start) / 0.14);
  const fadeIn = clamp01((t - start) / 0.14);
  if (t < leave - 0.14) return fadeIn;
  return 1 - clamp01((t - (leave - 0.14)) / 0.14);
}

/** 0..1 entrance for the intake papers. */
export function inputsRevealAt(time: number): number {
  return easeInOutCubic((time - 0.1) / 0.7);
}

/** 0..1 entrance for the persistent cohort pack. */
export function batchAt(time: number): number {
  return easeInOutCubic(time / 0.6);
}

/** 0..1 while the camera is between stations; used for a small carry lift. */
export function travelAt(time: number): number {
  const windows: Array<[number, number]> = [
    [4.1, 4.5],
    [9.6, 10],
    [16.1, 16.5],
    [23.1, 23.5],
    [30.6, 31],
    [38.1, 38.5],
    [43.6, 44],
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
  return clamp01((time - 4.6) / 1.6);
}

/** 0..1 wax seal on the raw-answer envelope. */
export function sealAt(time: number): number {
  return easeInOutCubic((time - 6.3) / 0.35);
}

/** 0..1 normalised-preference slip leaving the sealed envelope. */
export function normalisedAt(time: number): number {
  return easeInOutCubic((time - 6.7) / 0.6);
}

/** 0..1 press for boundary stamp i. */
export function stampAt(time: number, index: number): number {
  return easeInOutCubic((time - (10.1 + index * 0.24)) / 0.18);
}

/** 0..1 rise of the four segment folders. */
export function foldersAt(time: number): number {
  return easeInOutCubic((time - 10.95) / 0.45);
}

/** 0..1 pair ledger reveal. */
export function ledgerAt(time: number): number {
  return easeInOutCubic((time - 11.2) / 0.5);
}

/** 0..1 opening of the R-12 folder. */
export function openAt(time: number): number {
  return easeInOutCubic((time - 11.7) / 0.5);
}

/** 0..1 chosen pair lines in the match graph. */
export function matchAt(time: number): number {
  return easeInOutCubic((time - 23.7) / 1.5);
}

/** 0..1 strategy cards. */
export function strategyAt(time: number): number {
  return easeInOutCubic((time - 24.3) / 0.6);
}

/** 0..1 38-room proposal count. */
export function roomsAt(time: number): number {
  return easeInOutCubic((time - 24.7) / 0.4);
}

/** 0..1 fairness bars. */
export function fairnessBarsAt(time: number): number {
  return easeInOutCubic((time - 31.3) / 0.8);
}

/** 0..1 mean and floor lines. */
export function fairnessMeanAt(time: number): number {
  return easeInOutCubic((time - 31.9) / 0.4);
}

/** 0..1 fairness thread from R-12 to the review cards. */
export function fairnessThreadAt(time: number): number {
  return easeInOutCubic((time - 32.1) / 0.8);
}

/** 0..1 at-risk cards. */
export function fairnessRiskAt(time: number): number {
  return easeInOutCubic((time - 32.4) / 0.5);
}

/** 0..1 swap-pass ledger. */
export function fairnessSwapAt(time: number): number {
  return easeInOutCubic((time - 32.8) / 0.4);
}

/** 0..1 document cards. */
export function documentsAt(time: number): number {
  return easeInOutCubic((time - 38.7) / 0.7);
}

/** 0..1 reasons lines and note count. */
export function notesAt(time: number): number {
  return easeInOutCubic((time - 39.2) / 0.6);
}

/** 0..1 sealed raw-answer envelope. */
export function documentSealAt(time: number): number {
  return easeInOutCubic((time - 39.5) / 0.4);
}

/** 0..1 sign-off slip. */
export function signSlipAt(time: number): number {
  return easeInOutCubic((time - 44.1) / 0.5);
}

/** 0..1 signature stroke. */
export function signatureAt(time: number): number {
  return easeInOutCubic((time - 44.8) / 0.8);
}

/** 0..1 wax seal press. */
export function waxAt(time: number): number {
  return easeInOutCubic((time - 45.8) / 0.4);
}

/** 0..1 held key tag. */
export function keyAt(time: number): number {
  return easeInOutCubic((time - 46.1) / 0.3);
}

export function formatFilmTime(time: number): string {
  const t = Math.min(PIPELINE_DURATION, Math.max(0, time));
  return `00:${t.toFixed(1).padStart(4, "0")}`;
}
