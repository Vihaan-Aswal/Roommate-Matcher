import type { SatisfactionLabel } from "../../lib/apiClient";

interface FairnessBarChartProps {
  counts: Record<SatisfactionLabel, number>;
  percentages: Record<SatisfactionLabel, number>;
  onLabelClick: (label: SatisfactionLabel) => void;
}

const LABEL_ORDER: SatisfactionLabel[] = ["Excellent", "Good", "Okay", "Poor"];

/**
 * Four rows, not four colours: a bar length carries the count, and only the
 * below-floor label gets the attention colour.
 */
export function FairnessBarChart({
  counts,
  percentages,
  onLabelClick,
}: FairnessBarChartProps): JSX.Element {
  const maxCount = Math.max(1, ...LABEL_ORDER.map((label) => counts[label] ?? 0));

  return (
    <div className="desk-bars">
      {LABEL_ORDER.map((label) => {
        const count = counts[label] ?? 0;
        const percent = percentages[label] ?? 0;
        const widthPercent = (count / maxCount) * 100;

        return (
          <button
            className="desk-bar-row"
            data-tone={label === "Poor" ? "attention" : undefined}
            key={label}
            type="button"
            onClick={() => onLabelClick(label)}
            title={`Show the ${label.toLowerCase()} students`}
          >
            <span className="desk-bar-label">{label}</span>
            <span className="desk-bar-track" aria-hidden="true">
              <span style={{ width: `${widthPercent}%` }} />
            </span>
            <span className="desk-bar-value">
              {count} ({(percent * 100).toFixed(1)}%)
            </span>
          </button>
        );
      })}
    </div>
  );
}
