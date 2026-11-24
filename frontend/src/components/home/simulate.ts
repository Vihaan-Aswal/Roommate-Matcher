/**
 * Deterministic sample run for the public homepage.
 *
 * Pure arithmetic, no I/O. The same seed produces the same students, answers,
 * pair scores, rooms, labels and artifacts on every load. The figures are
 * illustrative sample data and are labelled as such on the page.
 */

export type Label = "Excellent" | "Good" | "Okay" | "Poor";
export type Gender = "M" | "F";
export type YearGroup = "1st year" | "2nd-4th year";
export type AcType = "AC" | "Non-AC";
export type RoomSize = 2 | 3 | 4;

export interface Answers {
  q1?: number; // sleep schedule, 0 early .. 4 late
  q2?: number; // cleanliness, 0 relaxed .. 4 exacting
  q3?: number; // latest return, 0 early .. 4 late
  q4?: { habit: number; comfort: number }; // room use, 0..2 each
  q5?: { habit: number; comfort: number }; // night activity, 0..2 each
  q6?: number; // smoking, 0 never .. 2 regular
  q7?: number; // alcohol, 0 never .. 2 regular
  q8?: number; // diet, 0 vegetarian, 1 vegan, 2 non-vegetarian
  q9?: number; // budget expectation, 0 low .. 4 high
  q10?: number; // tolerance, 0 low .. 4 high
}

export interface FactorDef {
  key: keyof Answers;
  label: string;
  weight: number;
  heavy: boolean;
}

export interface FactorResult {
  key: string;
  label: string;
  weight: number;
  raw: number;
  effectiveWeight: number;
  contribution: number;
  missing: boolean;
}

export interface PairResult {
  a: number;
  b: number;
  score: number;
  factors: FactorResult[];
}

export interface Student {
  index: number;
  id: string;
  segmentIndex: number;
  answers: Answers;
  satisfaction: number;
  label: Label;
  roomId: string | null;
  missingFactors: number;
}

export interface Room {
  id: string;
  segmentIndex: number;
  members: number[];
  edges: PairResult[];
  score: number;
  atRisk: number[];
}

export interface Segment {
  index: number;
  key: string;
  gender: Gender;
  year: YearGroup;
  ac: AcType;
  size: RoomSize;
  short: string;
  label: string;
  members: number[];
  rooms: Room[];
  mean: number;
  floor: number;
  atRisk: number[];
}

export interface Run {
  students: Student[];
  rooms: Room[];
  segments: Segment[];
  pairsPossible: number;
  pairsScored: number;
  pairsRejected: number;
  labelCounts: Record<Label, number>;
  atRiskStudents: Student[];
  floor: number;
  sortedStudents: Student[];
  studentReasons: string[][];
  samplePair: PairResult & { segments: Segment; room: Room; reasons: string[] };
  healthySegment: Segment;
  healthySegmentRoom: Room;
  audit: {
    runId: string;
    digest: string;
    swapsAccepted: number;
    swapPasses: number;
    newPoorFromSwaps: 0;
    artifacts: 4;
  };
}

export const RUN_SEED = 19;
export const TOTAL_STUDENTS = 96;
export const TOTAL_ROOMS = 38;

export const FACTORS: FactorDef[] = [
  { key: "q1", label: "Sleep schedule", weight: 0.2, heavy: true },
  { key: "q2", label: "Cleanliness", weight: 0.15, heavy: true },
  { key: "q6", label: "Smoking preference", weight: 0.15, heavy: true },
  { key: "q3", label: "Late return time", weight: 0.1, heavy: false },
  { key: "q4", label: "Room use", weight: 0.1, heavy: true },
  { key: "q5", label: "Night activity", weight: 0.1, heavy: true },
  { key: "q7", label: "Alcohol preference", weight: 0.05, heavy: false },
  { key: "q8", label: "Diet preference", weight: 0.05, heavy: false },
  { key: "q9", label: "Budget expectation", weight: 0.05, heavy: false },
  { key: "q10", label: "Lifestyle tolerance", weight: 0.05, heavy: false },
];

export const REASONS: Record<string, string> = {
  q1: "sleep schedules may need coordination",
  q2: "cleanliness expectations differ",
  q3: "return times may need agreeing",
  q4: "how the room is used may need coordinating",
  q5: "night routines may need agreeing",
  q6: "smoking preferences need checking",
  q7: "drinking preferences differ",
  q8: "dietary habits may need planning",
  q9: "budget expectations differ",
  q10: "how much difference each can live with may need a conversation",
};

const SEGMENT_DEFS: Array<{
  gender: Gender;
  year: YearGroup;
  ac: AcType;
  size: RoomSize;
}> = [
  { gender: "M", year: "1st year", ac: "AC", size: 2 },
  { gender: "M", year: "2nd-4th year", ac: "Non-AC", size: 3 },
  { gender: "F", year: "1st year", ac: "AC", size: 2 },
  { gender: "F", year: "2nd-4th year", ac: "Non-AC", size: 4 },
];

const SEGMENT_COUNT = 24; // students per segment, 4 x 24 = 96

// Symmetric compatibility matrices, indexed by the encoded answer.
const SMOKING = [
  [1, 0.55, 0.15],
  [0.55, 0.95, 0.5],
  [0.15, 0.5, 1],
];
const ALCOHOL = [
  [1, 0.7, 0.35],
  [0.7, 0.9, 0.7],
  [0.35, 0.7, 1],
];
const DIET = [
  [1, 0.8, 0.45],
  [0.8, 1, 0.35],
  [0.45, 0.35, 1],
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pickOne(rng: () => number, values: number[], weights: number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < values.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return values[i];
  }
  return values[values.length - 1];
}

const ARCHETYPES = [
  { sleep: 1.1, clean: 1.3, late: 0.9, budget: 1.6, tolerance: 3.4, useHabit: 0.7, useComfort: 0.9, nightHabit: 0.7, nightComfort: 1.0 },
  { sleep: 3.4, clean: 2.3, late: 3.2, budget: 2.6, tolerance: 2.9, useHabit: 1.8, useComfort: 1.7, nightHabit: 1.8, nightComfort: 1.6 },
  { sleep: 2.3, clean: 2.5, late: 2.1, budget: 2.2, tolerance: 3.0, useHabit: 1.3, useComfort: 1.2, nightHabit: 1.3, nightComfort: 1.3 },
  { sleep: 1.6, clean: 3.4, late: 1.2, budget: 3.0, tolerance: 1.9, useHabit: 0.8, useComfort: 0.7, nightHabit: 0.8, nightComfort: 0.8 },
  { sleep: 2.6, clean: 1.6, late: 2.6, budget: 2.0, tolerance: 2.4, useHabit: 1.5, useComfort: 1.1, nightHabit: 1.5, nightComfort: 1.2 },
];

function buildAnswers(rng: () => number): Answers {
  const archetype = pickOne(rng, [0, 1, 2, 3, 4], [0.2, 0.22, 0.24, 0.16, 0.18]);
  const base = ARCHETYPES[archetype];
  const noisy = (value: number, spread: number, max: number) =>
    clamp(Math.round(value + (rng() - 0.5) * 2 * spread), 0, max);

  const hardCase = rng() < 0.02;
  const answer = (value: number, spread: number) =>
    hardCase ? Math.round(rng() * 4) : noisy(value, spread, 4);

  const answers: Answers = {
    q1: answer(base.sleep, 1.1),
    q2: answer(base.clean, 1.1),
    q3: answer(base.late, 1.2),
    q9: answer(base.budget, 1.2),
    q10: answer(base.tolerance, 1.4),
    q6: pickOne(rng, [0, 1, 2], archetype === 1 ? [0.55, 0.3, 0.15] : [0.8, 0.16, 0.04]),
    q7: pickOne(rng, [0, 1, 2], archetype === 1 ? [0.35, 0.4, 0.25] : [0.62, 0.27, 0.11]),
    q8: pickOne(rng, [0, 1, 2], [0.55, 0.07, 0.38]),
    q4: {
      habit: noisy(base.useHabit, 0.9, 2),
      comfort: noisy(base.useComfort, 0.8, 2),
    },
    q5: {
      habit: noisy(base.nightHabit, 0.9, 2),
      comfort: noisy(base.nightComfort, 0.8, 2),
    },
  };

  // A handful of students leave a question blank; scoring renormalises.
  const blanks: Array<keyof Answers> = ["q1", "q2", "q3", "q4", "q5", "q7", "q8", "q9", "q10"];
  for (const key of blanks) {
    if (rng() < 0.035) delete answers[key];
  }
  return answers;
}

function distanceScore(a: number | undefined, b: number | undefined, span: number): number | null {
  if (a === undefined || b === undefined) return null;
  return 1 - Math.abs(a - b) / span;
}

function directionalScore(
  a: { habit: number; comfort: number } | undefined,
  b: { habit: number; comfort: number } | undefined,
): number | null {
  if (!a || !b) return null;
  const penalty = Math.max(0, a.habit - b.comfort, b.habit - a.comfort) / 2;
  return 1 - penalty;
}

function matrixScore(
  a: number | undefined,
  b: number | undefined,
  matrix: number[][],
): number | null {
  if (a === undefined || b === undefined) return null;
  return matrix[a][b];
}

function factorRaw(
  factor: FactorDef,
  a: Answers,
  b: Answers,
): number | null {
  switch (factor.key) {
    case "q1":
      return distanceScore(a.q1, b.q1, 4);
    case "q2":
      return distanceScore(a.q2, b.q2, 4);
    case "q3":
      return distanceScore(a.q3, b.q3, 4);
    case "q4":
      return directionalScore(a.q4, b.q4);
    case "q5":
      return directionalScore(a.q5, b.q5);
    case "q6":
      return matrixScore(a.q6, b.q6, SMOKING);
    case "q7":
      return matrixScore(a.q7, b.q7, ALCOHOL);
    case "q8":
      return matrixScore(a.q8, b.q8, DIET);
    case "q9":
      return distanceScore(a.q9, b.q9, 4);
    case "q10":
      return distanceScore(a.q10, b.q10, 4);
    default:
      return null;
  }
}

export function scorePair(a: Answers, b: Answers): { factors: FactorResult[]; score: number } {
  const factors: FactorResult[] = FACTORS.map((factor) => {
    const raw = factorRaw(factor, a, b);
    return {
      key: factor.key,
      label: factor.label,
      weight: factor.weight,
      raw: raw ?? 0,
      effectiveWeight: factor.weight,
      contribution: 0,
      missing: raw === null,
    };
  });

  const presentWeight = factors
    .filter((factor) => !factor.missing)
    .reduce((sum, factor) => sum + factor.weight, 0);

  let score = 0;
  for (const factor of factors) {
    if (factor.missing || presentWeight === 0) {
      factor.effectiveWeight = 0;
      factor.contribution = 0;
      continue;
    }
    factor.effectiveWeight = factor.weight / presentWeight;
    factor.contribution = factor.raw * factor.effectiveWeight;
    score += factor.contribution;
  }

  return { factors, score: clamp(score, 0, 1) };
}

function heavyFactorsNonZero(factors: FactorResult[]): boolean {
  return factors
    .filter((factor) => FACTORS.find((def) => def.key === factor.key)?.heavy)
    .every((factor) => !factor.missing && factor.raw > 0);
}

export function labelForScore(score: number, factors?: FactorResult[]): Label {
  if (score >= 0.9 && (!factors || heavyFactorsNonZero(factors))) return "Excellent";
  if (score >= 0.7) return "Good";
  if (score >= 0.55) return "Okay";
  return "Poor";
}

function emptyAnswers(): Answers {
  return {};
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

class PairBook {
  private readonly scores = new Map<string, PairResult>();

  constructor(private readonly students: Student[]) {}

  get(a: number, b: number): PairResult {
    const key = pairKey(a, b);
    const hit = this.scores.get(key);
    if (hit) return hit;
    const outcome = scorePair(this.students[a].answers, this.students[b].answers);
    const result: PairResult = { a: Math.min(a, b), b: Math.max(a, b), ...outcome };
    this.scores.set(key, result);
    return result;
  }

  count(): number {
    return this.scores.size;
  }
}

function studentSatisfaction(members: number[], student: number, book: PairBook): number {
  const edges = members.filter((member) => member !== student).map((member) => book.get(student, member).score);
  return mean(edges);
}

interface Assignment {
  rooms: Room[];
}

function makeRoom(
  id: string,
  segmentIndex: number,
  members: number[],
  book: PairBook,
): Room {
  const edges: PairResult[] = [];
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      edges.push(book.get(members[i], members[j]));
    }
  }
  const atRisk = members.filter(
    (member) => studentSatisfaction(members, member, book) < 0.55,
  );
  return {
    id,
    segmentIndex,
    members: [...members],
    edges,
    score: mean(edges.map((edge) => edge.score)),
    atRisk,
  };
}

function greedyPairs(members: number[], book: PairBook): Array<[number, number]> {
  const remaining = new Set(members);
  const pairs: Array<[number, number]> = [];
  while (remaining.size >= 2) {
    let best: [number, number] | null = null;
    let bestScore = -1;
    const ordered = [...remaining].sort((a, b) => a - b);
    for (let i = 0; i < ordered.length; i += 1) {
      for (let j = i + 1; j < ordered.length; j += 1) {
        const score = book.get(ordered[i], ordered[j]).score;
        if (score > bestScore + 1e-12) {
          bestScore = score;
          best = [ordered[i], ordered[j]];
        }
      }
    }
    if (!best) break;
    pairs.push(best);
    remaining.delete(best[0]);
    remaining.delete(best[1]);
  }
  return pairs;
}

function assignSegment(
  segmentIndex: number,
  members: number[],
  size: RoomSize,
  book: PairBook,
  firstRoomNumber: number,
): Assignment {
  const rooms: Room[] = [];
  const roomId = (offset: number) => `R-${String(firstRoomNumber + offset).padStart(2, "0")}`;

  if (size === 2) {
    const pairs = greedyPairs(members, book);
    pairs.forEach(([a, b], index) => {
      rooms.push(makeRoom(roomId(index), segmentIndex, [a, b], book));
    });
    return { rooms };
  }

  if (size === 3) {
    const pairs = greedyPairs(members, book).sort(
      (left, right) => book.get(right[0], right[1]).score - book.get(left[0], left[1]).score,
    );
    // 24 students -> 12 pairs. The 8 strongest pairs are seeds; the students in
    // the four weakest pairs rejoin as third members.
    const seedPairs = pairs.slice(0, 8);
    const singles = pairs.slice(8).flat();
    // Each seed pair grows by exactly one third member. The tightest seeds —
    // fewest candidates averaging 0.70 or better — choose first.
    const growth = seedPairs.map((pair) => {
      const options = singles.filter(
        (single) =>
          (book.get(pair[0], single).score + book.get(pair[1], single).score) / 2 >= 0.7,
      ).length;
      const best = Math.max(
        ...singles.map(
          (single) =>
            (book.get(pair[0], single).score + book.get(pair[1], single).score) / 2,
        ),
      );
      return { pair, options, best };
    });
    growth.sort(
      (left, right) =>
        left.options - right.options ||
        left.best - right.best ||
        left.pair[0] - right.pair[0],
    );
    const pool = [...singles];
    const roomsLeft: number[][] = growth.map(({ pair }) => {
      let bestSingle = 0;
      let bestAverage = -1;
      pool.forEach((single, index) => {
        const average =
          (book.get(pair[0], single).score + book.get(pair[1], single).score) / 2;
        if (average > bestAverage + 1e-12) {
          bestAverage = average;
          bestSingle = index;
        }
      });
      const [single] = pool.splice(bestSingle, 1);
      return [pair[0], pair[1], single];
    });
    roomsLeft.forEach((membersOfRoom, index) => {
      rooms.push(makeRoom(roomId(index), segmentIndex, membersOfRoom, book));
    });
    return { rooms };
  }

  // 4-bed: pair, then merge pairs by the mean of the six edges in the quad.
  const pairs = greedyPairs(members, book);
  const quads: Array<[number, number, number, number]> = [];
  const remaining = [...pairs];
  while (remaining.length >= 2) {
    let bestA = 0;
    let bestB = 1;
    let bestMean = -1;
    for (let i = 0; i < remaining.length; i += 1) {
      for (let j = i + 1; j < remaining.length; j += 1) {
        const quad = [...remaining[i], ...remaining[j]];
        let total = 0;
        let minimum = 1;
        for (let x = 0; x < quad.length; x += 1) {
          for (let y = x + 1; y < quad.length; y += 1) {
            const score = book.get(quad[x], quad[y]).score;
            total += score;
            minimum = Math.min(minimum, score);
          }
        }
        const mergeScore = total / 6 + minimum * 0.000001;
        if (mergeScore > bestMean + 1e-12) {
          bestMean = mergeScore;
          bestA = i;
          bestB = j;
        }
      }
    }
    const left = remaining[bestA];
    const right = remaining[bestB];
    quads.push([left[0], left[1], right[0], right[1]]);
    remaining.splice(bestB, 1);
    remaining.splice(bestA, 1);
  }
  quads.forEach((membersOfRoom, index) => {
    rooms.push(makeRoom(roomId(index), segmentIndex, membersOfRoom, book));
  });
  return { rooms };
}

function allRoomScores(rooms: Room[]): number[] {
  return rooms.map((room) => room.score);
}

function recomputeRooms(rooms: Room[], book: PairBook): void {
  for (const room of rooms) {
    const edges: PairResult[] = [];
    for (let i = 0; i < room.members.length; i += 1) {
      for (let j = i + 1; j < room.members.length; j += 1) {
        edges.push(book.get(room.members[i], room.members[j]));
      }
    }
    room.edges = edges;
    room.score = mean(edges.map((edge) => edge.score));
    room.atRisk = [];
    for (const member of room.members) {
      if (studentSatisfaction(room.members, member, book) < 0.55) {
        room.atRisk.push(member);
      }
    }
  }
}

function runSwapPass(
  students: Student[],
  rooms: Room[],
  book: PairBook,
): boolean {
  const beforeMin = Math.min(...students.map((student) => student.satisfaction));
  let best: { roomA: number; roomB: number; a: number; b: number; minimum: number; total: number } | null =
    null;

  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      const roomA = rooms[i];
      const roomB = rooms[j];
      if (roomA.segmentIndex !== roomB.segmentIndex) continue;
      for (const a of roomA.members) {
        for (const b of roomB.members) {
          const membersA = roomA.members.map((member) => (member === a ? b : member));
          const membersB = roomB.members.map((member) => (member === b ? a : member));
          const affected = [...membersA, ...membersB];
          let minimum = 1;
          let total = 0;
          let newPoor = 0;
          for (const member of affected) {
            const members = membersA.includes(member) ? membersA : membersB;
            const satisfaction = studentSatisfaction(members, member, book);
            minimum = Math.min(minimum, satisfaction);
            total += satisfaction;
            if (satisfaction < 0.55 && students[member].satisfaction >= 0.55) {
              newPoor += 1;
            }
          }
          if (newPoor > 0 || minimum <= beforeMin + 1e-12) continue;
          if (
            !best ||
            minimum > best.minimum + 1e-12 ||
            (Math.abs(minimum - best.minimum) <= 1e-12 && total > best.total + 1e-12)
          ) {
            best = { roomA: i, roomB: j, a, b, minimum, total };
          }
        }
      }
    }
  }

  if (!best) return false;

  const roomA = rooms[best.roomA];
  const roomB = rooms[best.roomB];
  roomA.members = roomA.members.map((member) => (member === best!.a ? best!.b : member));
  roomB.members = roomB.members.map((member) => (member === best!.b ? best!.a : member));
  recomputeRooms([roomA, roomB], book);
  for (const member of [...roomA.members, ...roomB.members]) {
    const room = roomA.members.includes(member) ? roomA : roomB;
    students[member].satisfaction = studentSatisfaction(room.members, member, book);
    students[member].label = labelForScore(students[member].satisfaction);
    students[member].roomId = room.id;
  }
  return true;
}

function digestRun(students: Student[], rooms: Room[]): string {
  let hash = 0x811c9dc5;
  const feed = (text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  };
  for (const student of students) {
    feed(JSON.stringify(student.answers));
    feed(student.roomId ?? "");
  }
  for (const room of rooms) {
    feed(room.id);
    feed(room.members.join(","));
  }
  return hash.toString(16).toUpperCase().padStart(8, "0");
}

export function buildRun(seed: number = RUN_SEED): Run {
  const rng = mulberry32(seed);

  const students: Student[] = [];
  for (let index = 0; index < TOTAL_STUDENTS; index += 1) {
    const segmentIndex = Math.floor(index / SEGMENT_COUNT);
    students.push({
      index,
      id: `S-${String(index + 1).padStart(3, "0")}`,
      segmentIndex,
      answers: buildAnswers(rng),
      satisfaction: 0,
      label: "Okay",
      roomId: null,
      missingFactors: 0,
    });
  }

  const book = new PairBook(students);
  let firstRoomNumber = 1;
  const segments: Segment[] = SEGMENT_DEFS.map((definition, segmentIndex) => {
    const members = students
      .filter((student) => student.segmentIndex === segmentIndex)
      .map((student) => student.index);
    const { rooms } = assignSegment(
      segmentIndex,
      members,
      definition.size,
      book,
      firstRoomNumber,
    );
    firstRoomNumber += rooms.length;
    return {
      index: segmentIndex,
      key: `${definition.gender}_${definition.year}_${definition.ac}_${definition.size}`,
      ...definition,
      short: `${definition.gender} · ${definition.year === "1st year" ? "1st" : "2nd–4th"} · ${definition.ac} · ${definition.size}-bed`,
      label: `${definition.gender === "M" ? "Men" : "Women"} · ${definition.year} · ${definition.ac} · ${definition.size}-bed`,
      members,
      rooms,
      mean: 0,
      floor: 0,
      atRisk: [],
    };
  });

  // Every eligible pair is scored: four segments of 24, C(24,2) x 4 = 1,104.
  for (const segment of segments) {
    for (let i = 0; i < segment.members.length; i += 1) {
      for (let j = i + 1; j < segment.members.length; j += 1) {
        book.get(segment.members[i], segment.members[j]);
      }
    }
  }

  const allRooms = segments.flatMap((segment) => segment.rooms);

  // Student satisfaction is the mean compatibility with the roommates they got.
  for (const room of allRooms) {
    for (const member of room.members) {
      const satisfaction = studentSatisfaction(room.members, member, book);
      students[member].satisfaction = satisfaction;
      students[member].label = labelForScore(satisfaction);
      students[member].roomId = room.id;
    }
  }

  let swapsAccepted = 0;
  let swapPasses = 0;
  for (let pass = 0; pass < 3; pass += 1) {
    swapPasses += 1;
    if (!runSwapPass(students, allRooms, book)) break;
    swapsAccepted += 1;
  }

  // Missing factor counts are display material.
  for (const student of students) {
    student.missingFactors = FACTORS.filter(
      (factor) => student.answers[factor.key] === undefined,
    ).length;
  }

  for (const segment of segments) {
    const memberStudents = segment.members.map((index) => students[index]);
    segment.mean = mean(memberStudents.map((student) => student.satisfaction));
    segment.floor = Math.min(...segment.rooms.map((room) => room.score));
    segment.atRisk = memberStudents.filter((student) => student.label === "Poor").map((student) => student.index);
  }

  const labelCounts: Record<Label, number> = {
    Excellent: 0,
    Good: 0,
    Okay: 0,
    Poor: 0,
  };
  for (const student of students) labelCounts[student.label] += 1;

  const atRiskStudents = students.filter((student) => student.label === "Poor");
  const floor = Math.min(...allRooms.map((room) => room.score));

  const sortedStudents = [...students].sort(
    (left, right) =>
      left.satisfaction - right.satisfaction ||
      left.index - right.index,
  );

  // Per-student reasons are aggregated across that student's edges to the room,
  // then rendered through the neutral phrase catalogue.
  const studentReasons: string[][] = students.map(() => []);
  for (const room of allRooms) {
    for (const member of room.members) {
      const edges = room.members
        .filter((other) => other !== member)
        .map((other) => book.get(member, other));
      const factorMeans = FACTORS.flatMap((definition) => {
        const values = edges
          .map((edge) => edge.factors.find((factor) => factor.key === definition.key))
          .filter((factor): factor is FactorResult => factor !== undefined && !factor.missing);
        if (values.length === 0) return [];
        return [{ key: definition.key, raw: mean(values.map((factor) => factor.raw)) }];
      }).sort(
        (left, right) =>
          left.raw - right.raw || String(left.key).localeCompare(String(right.key)),
      );
      studentReasons[member] = factorMeans.slice(0, 2).map((factor) => REASONS[factor.key]);
    }
  }

  // A segment that looks healthy on its mean but still holds a room to visit.
  const healthySegment =
    [...segments]
      .filter((segment) => segment.atRisk.length > 0 || segment.floor < 0.62)
      .sort((left, right) => right.mean - left.mean)[0] ?? segments[0];
  const healthySegmentRoom = [...healthySegment.rooms].sort(
    (left, right) => left.score - right.score,
  )[0];

  // One pair, mid-range and inside a real room, for the compatibility sheet.
  const candidatePairs: Array<{ pair: PairResult; room: Room; segment: Segment }> = [];
  for (const segment of segments) {
    for (const room of segment.rooms) {
      for (const edge of room.edges) {
        candidatePairs.push({ pair: edge, room, segment });
      }
    }
  }
  const sample =
    candidatePairs
      .filter(
        ({ pair, room }) =>
          room.members.length > 2 &&
          pair.factors.every((factor) => !factor.missing) &&
          pair.score >= 0.66 &&
          pair.score <= 0.82,
      )
      .sort(
        (left, right) =>
          Math.abs(left.pair.score - 0.74) - Math.abs(right.pair.score - 0.74) ||
          Math.abs(left.room.score - left.segment.mean) -
            Math.abs(right.room.score - right.segment.mean) ||
          left.pair.a - right.pair.a,
      )[0] ?? candidatePairs.sort((left, right) => right.pair.score - left.pair.score)[0];

  const reasonPool = sample.pair.factors
    .filter((factor) => !factor.missing)
    .sort((left, right) => left.raw - right.raw || left.contribution - right.contribution)
    .slice(0, 2);
  const reasons = reasonPool.map((factor) => REASONS[factor.key]);

  const digest = digestRun(students, allRooms);

  return {
    students,
    rooms: allRooms,
    segments,
    pairsPossible: (TOTAL_STUDENTS * (TOTAL_STUDENTS - 1)) / 2,
    pairsScored: book.count(),
    pairsRejected: (TOTAL_STUDENTS * (TOTAL_STUDENTS - 1)) / 2 - book.count(),
    labelCounts,
    atRiskStudents,
    floor,
    sortedStudents,
    studentReasons,
    samplePair: { ...sample.pair, segments: sample.segment, room: sample.room, reasons },
    healthySegment,
    healthySegmentRoom,
    audit: {
      runId: `RM-${digest.slice(0, 6)}`,
      digest,
      swapsAccepted,
      swapPasses,
      newPoorFromSwaps: 0,
      artifacts: 4,
    },
  };
}

export function formatScore(value: number): string {
  return value.toFixed(2);
}

export function formatCount(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export const run = buildRun();

export interface SampleCasePair {
  pair: PairResult;
  room: Room;
  segment: Segment;
  students: [Student, Student];
  lowestFactors: FactorResult[];
  missingFactors: FactorResult[];
}

export interface SampleCase {
  boundary: {
    students: number;
    rooms: number;
    segments: number;
    possible: number;
    rejected: number;
    scored: number;
  };
  risk: SampleCasePair & { atRisk: Student[] };
  healthy: SampleCasePair;
  segments: Segment[];
  labels: Record<Label, number>;
  audit: Run["audit"];
  notes: Array<{ student: Student; reasons: string[] }>;
}

function casePair(source: Run, pair: PairResult, room: Room, segment: Segment): SampleCasePair {
  const ordered = [...pair.factors]
    .filter((factor) => !factor.missing)
    .sort((left, right) => left.raw - right.raw);
  return {
    pair,
    room,
    segment,
    students: [source.students[pair.a], source.students[pair.b]],
    lowestFactors: ordered,
    missingFactors: pair.factors.filter((factor) => factor.missing),
  };
}

/**
 * The named exhibits used by the homepage film. Pure selection over the run;
 * it never recomputes a score.
 */
export function selectSampleCase(source: Run = run): SampleCase {
  const atRiskStudent = source.atRiskStudents[0];
  const riskRoom = atRiskStudent
    ? source.rooms.find((room) => room.id === atRiskStudent.roomId)
    : undefined;
  if (!atRiskStudent || !riskRoom) {
    throw new Error("The sample run has no at-risk room.");
  }
  const riskSegment = source.segments[riskRoom.segmentIndex];
  const riskEdge = [...riskRoom.edges].sort((left, right) => left.score - right.score)[0];

  const healthyPair = source.samplePair;
  const healthySegment = source.segments[healthyPair.room.segmentIndex];

  const noteStudents = [
    atRiskStudent,
    ...source.students.filter((student) => riskRoom.members.includes(student.index)),
    source.students[healthyPair.a],
    source.students[healthyPair.b],
  ];
  const notes = noteStudents
    .filter((student, index, all) => all.findIndex((other) => other.id === student.id) === index)
    .map((student) => ({ student, reasons: source.studentReasons[student.index] ?? [] }));

  return {
    boundary: {
      students: source.students.length,
      rooms: source.rooms.length,
      segments: source.segments.length,
      possible: source.pairsPossible,
      rejected: source.pairsRejected,
      scored: source.pairsScored,
    },
    risk: {
      ...casePair(source, riskEdge, riskRoom, riskSegment),
      atRisk: riskRoom.atRisk.map((member) => source.students[member]),
    },
    healthy: casePair(source, healthyPair, healthyPair.room, healthySegment),
    segments: source.segments,
    labels: source.labelCounts,
    audit: source.audit,
    notes,
  };
}

export const sampleCase = selectSampleCase(run);


