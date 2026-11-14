import { describe, expect, it } from "vitest";

import {
  buildRun,
  FACTORS,
  labelForScore,
  scorePair,
  formatCount,
  type Run,
} from "../../components/home/simulate";

function roomSizeFor(run: Run, roomId: string | null): number | null {
  if (!roomId) return null;
  return run.rooms.find((room) => room.id === roomId)?.members.length ?? null;
}

describe("seeded homepage sample run", () => {
  const run = buildRun();

  it("computes the sample totals from the fixture", () => {
    expect(run.students).toHaveLength(96);
    expect(run.rooms).toHaveLength(38);
    expect(run.segments).toHaveLength(4);
    expect(run.pairsPossible).toBe(4560);
    expect(run.pairsScored).toBe(1104);
    expect(run.pairsRejected).toBe(3456);
    expect(run.labelCounts.Excellent + run.labelCounts.Good + run.labelCounts.Okay + run.labelCounts.Poor).toBe(96);
  });

  it("is deterministic, including the digest and pair score", () => {
    const again = buildRun();
    expect(again.audit.digest).toBe(run.audit.digest);
    expect(again.labelCounts).toEqual(run.labelCounts);
    expect(again.samplePair.score).toBe(run.samplePair.score);
    expect(again.rooms.map((room) => room.members)).toEqual(run.rooms.map((room) => room.members));
  });

  it("keeps every room inside one segment and at the segment's bed size", () => {
    const seen = new Set<number>();
    for (const room of run.rooms) {
      const segment = run.segments[room.segmentIndex];
      expect(room.members).toHaveLength(segment.size);
      for (const member of room.members) {
        expect(run.students[member].segmentIndex).toBe(segment.index);
        expect(seen.has(member)).toBe(false);
        seen.add(member);
      }
    }
    expect(seen.size).toBe(96);
  });

  it("scores real pairs with weights that renormalise", () => {
    const pair = run.samplePair;
    const recomputed = scorePair(
      run.students[pair.a].answers,
      run.students[pair.b].answers,
    );
    expect(recomputed.score).toBeCloseTo(pair.score, 12);

    const present = pair.factors.filter((factor) => !factor.missing);
    const effectiveTotal = present.reduce(
      (total, factor) => total + factor.effectiveWeight,
      0,
    );
    expect(effectiveTotal).toBeCloseTo(1, 10);
    const contributionTotal = pair.factors.reduce(
      (total, factor) => total + factor.contribution,
      0,
    );
    expect(contributionTotal).toBeCloseTo(pair.score, 10);
    expect(FACTORS.reduce((total, factor) => total + factor.weight, 0)).toBeCloseTo(1, 10);
  });

  it("reports a floor with two at-risk students and one weak room", () => {
    expect(run.atRiskStudents).toHaveLength(2);
    expect(run.labelCounts.Poor).toBe(2);
    expect(run.floor).toBeLessThan(0.55);
    expect(run.atRiskStudents.every((student) => student.roomId === run.atRiskStudents[0].roomId)).toBe(true);
    expect(roomSizeFor(run, run.atRiskStudents[0].roomId)).not.toBeNull();
    expect(run.healthySegment.atRisk.length).toBe(2);
    expect(run.healthySegment.mean).toBeGreaterThan(run.healthySegmentRoom.score);
  });

  it("labels scores at the documented thresholds", () => {
    expect(labelForScore(0.95)).toBe("Excellent");
    expect(labelForScore(0.75)).toBe("Good");
    expect(labelForScore(0.56)).toBe("Okay");
    expect(labelForScore(0.54)).toBe("Poor");
    expect(
      labelForScore(0.95, [
        {
          key: "q6",
          label: "Smoking preference",
          weight: 0.15,
          raw: 0,
          effectiveWeight: 0.15,
          contribution: 0,
          missing: false,
        },
      ]),
    ).toBe("Good");
  });

  it("formats large counts without locale drift", () => {
    expect(formatCount(1104)).toBe("1,104");
    expect(formatCount(96)).toBe("96");
  });
});
