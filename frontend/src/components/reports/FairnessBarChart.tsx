import type { SatisfactionLabel } from "../../lib/apiClient";

interface FairnessBarChartProps {
  counts: Record<SatisfactionLabel, number>;
  percentages: Record<SatisfactionLabel, number>;
  onLabelClick: (label: SatisfactionLabel) => void;
}

const LABEL_ORDER: SatisfactionLabel[] = ["Excellent", "Good", "Okay", "Poor"];

const BAR_COLORS: Record<SatisfactionLabel, string> = {
  Excellent: "bg-emerald-500",
  Good: "bg-sky-500",
  Okay: "bg-amber-500",
  Poor: "bg-rose-500",
};

export function FairnessBarChart({
  counts,
  percentages,
  onLabelClick,
}: FairnessBarChartProps): JSX.Element {
  const maxCount = Math.max(1, ...LABEL_ORDER.map((label) => counts[label] ?? 0));

  return (
    <div className="space-y-3">
      {LABEL_ORDER.map((label) => {
        const count = counts[label] ?? 0;
        const percent = percentages[label] ?? 0;
        const widthPercent = (count / maxCount) * 100;

        return (
          <button
            key={label}
            className="w-full rounded-lg border border-border/70 p-3 text-left transition hover:bg-muted/30"
            type="button"
            onClick={() => onLabelClick(label)}
          >
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{label}</span>
              <span className="text-muted-foreground">
                {count} ({(percent * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-muted">
              <div
                className={`h-2.5 rounded-full ${BAR_COLORS[label]}`}
                style={{ width: `${widthPercent}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
