import type { SatisfactionLabel } from "./apiClient";

export function formatScorePercent(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

export function roomHealthLabel(
  needsReview: boolean,
): "Healthy" | "Needs Review" {
  return needsReview ? "Needs Review" : "Healthy";
}

export function summarizeReasons(reasons: string[]): {
  visibleReasons: string[];
  overflowCount: number;
} {
  const visibleReasons = reasons.slice(0, 2);
  const overflowCount = Math.max(0, reasons.length - visibleReasons.length);
  return { visibleReasons, overflowCount };
}

export function satisfactionSortRank(label: SatisfactionLabel): number {
  const order: Record<SatisfactionLabel, number> = {
    Excellent: 0,
    Good: 1,
    Okay: 2,
    Poor: 3,
  };
  return order[label];
}
