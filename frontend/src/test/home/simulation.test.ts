// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildRun,
  FACTORS,
  labelForScore,
  sampleCase,
  scorePair,
  formatCount,
  selectSampleCase,
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

describe("sampleCase selectors", () => {
  it("selects R-12, the risk pair and its floor evidence", () => {
    expect(sampleCase.risk.room.id).toBe("R-12");
    expect(sampleCase.risk.students.map((student) => student.id)).toEqual([
      "S-009",
      "S-021",
    ]);
    expect(sampleCase.risk.pair.score).toBeCloseTo(0.416, 3);
    expect(sampleCase.risk.room.score).toBeCloseTo(0.416, 3);
    expect(sampleCase.risk.atRisk).toHaveLength(2);
    expect(sampleCase.risk.missingFactors.map((factor) => factor.label)).toEqual([
      "Sleep schedule",
    ]);
    expect(
      sampleCase.risk.lowestFactors.slice(0, 4).map((factor) => [factor.label, factor.raw]),
    ).toEqual([
      ["Cleanliness", 0],
      ["Room use", 0],
      ["Night activity", 0],
      ["Lifestyle tolerance", 0.25],
    ]);
    expect(sampleCase.risk.segment.mean).toBeCloseTo(0.827, 3);
  });

  it("selects R-15 as the healthy contrast with the same rules", () => {
    expect(sampleCase.healthy.room.id).toBe("R-15");
    expect(sampleCase.healthy.students.map((student) => student.id)).toEqual([
      "S-035",
      "S-047",
    ]);
    expect(sampleCase.healthy.pair.score).toBeCloseTo(0.733, 3);
    expect(
      sampleCase.healthy.lowestFactors.slice(0, 3).map((factor) => [factor.label, factor.raw]),
    ).toEqual([
      ["Cleanliness", 0.25],
      ["Late return time", 0.25],
      ["Smoking preference", 0.55],
    ]);
    expect(sampleCase.healthy.pair.factors).toHaveLength(FACTORS.length);
  });

  it("keeps the published boundary, label and audit figures", () => {
    expect(sampleCase.boundary).toMatchObject({
      students: 96,
      rooms: 38,
      segments: 4,
      possible: 4560,
      rejected: 3456,
      scored: 1104,
    });
    expect(sampleCase.labels).toEqual({ Excellent: 25, Good: 65, Okay: 4, Poor: 2 });
    expect(sampleCase.audit.swapPasses).toBe(3);
    expect(sampleCase.audit.swapsAccepted).toBe(3);
    expect(sampleCase.audit.newPoorFromSwaps).toBe(0);
    expect(sampleCase.audit.runId).toBe("RM-D1C916");
    expect(sampleCase.audit.digest).toBe("D1C9167C");
    expect(sampleCase.notes.length).toBeGreaterThan(0);
    expect(sampleCase.notes.some(({ student }) => student.id === "S-009")).toBe(true);
  });

  it("is deterministic across builds", () => {
    const again = selectSampleCase(buildRun());
    expect(again.risk.room.id).toBe(sampleCase.risk.room.id);
    expect(again.risk.pair.score).toBe(sampleCase.risk.pair.score);
    expect(again.healthy.students.map((student) => student.id)).toEqual(
      sampleCase.healthy.students.map((student) => student.id),
    );
    expect(again.labels).toEqual(sampleCase.labels);
    expect(again.audit).toEqual(sampleCase.audit);
  });
});
