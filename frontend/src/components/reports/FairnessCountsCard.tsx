import type { SatisfactionLabel, SegmentFairnessRow } from "../../lib/apiClient";

interface FairnessCountsCardProps {
  segment: SegmentFairnessRow;
  onSegmentLabelClick: (segmentKey: string, label: SatisfactionLabel) => void;
  onSegmentAtRiskClick: (segmentKey: string) => void;
}

const LABEL_ORDER: SatisfactionLabel[] = ["Excellent", "Good", "Okay", "Poor"];

export function FairnessCountsCard({
  segment,
  onSegmentLabelClick,
  onSegmentAtRiskClick,
}: FairnessCountsCardProps): JSX.Element {
  return (
    <article className="space-y-3 rounded-lg border border-border/70 bg-white/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-medium">{segment.segment_key}</h4>
        <p className="text-xs text-muted-foreground">
          {segment.total_students} students
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {LABEL_ORDER.map((label) => (
          <button
            key={`${segment.segment_key}-${label}`}
            className="rounded-md border border-border/70 px-3 py-2 text-left text-sm hover:bg-muted/30"
            type="button"
            onClick={() => onSegmentLabelClick(segment.segment_key, label)}
          >
            <p className="font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">
              {segment.label_counts[label] ?? 0} ({((segment.label_percentages[label] ?? 0) * 100).toFixed(1)}%)
            </p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          className="rounded-md border border-border/70 px-3 py-2 hover:bg-muted/30"
          type="button"
          onClick={() => onSegmentAtRiskClick(segment.segment_key)}
        >
          At risk: {segment.at_risk_count}
        </button>
        <span className="text-muted-foreground">
          Minimum satisfaction: {(segment.minimum_satisfaction * 100).toFixed(1)}%
        </span>
      </div>
    </article>
  );
}
