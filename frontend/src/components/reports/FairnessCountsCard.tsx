import type { SatisfactionLabel, SegmentFairnessRow } from "../../lib/apiClient";
import { SegmentLabel } from "../SegmentLabel";

interface FairnessCountsCardProps {
  segment: SegmentFairnessRow;
  onSegmentLabelClick: (segmentKey: string, label: SatisfactionLabel) => void;
  onSegmentAtRiskClick: (segmentKey: string) => void;
}

const LABEL_ORDER: SatisfactionLabel[] = ["Excellent", "Good", "Okay", "Poor"];

const FILL: Record<SatisfactionLabel, string> = {
  Excellent: "var(--paper-ink)",
  Good: "rgba(29,37,25,0.62)",
  Okay: "rgba(29,37,25,0.32)",
  Poor: "var(--amber)",
};

/** One segment's floor: distribution, the at-risk count, and the weakest score. */
export function FairnessCountsCard({
  segment,
  onSegmentLabelClick,
  onSegmentAtRiskClick,
}: FairnessCountsCardProps): JSX.Element {
  const total = segment.total_students;

  return (
    <article className="desk-panel desk-stack-sm">
      <div className="desk-stack-sm" style={{ gap: 2 }}>
        <h3 style={{ fontFamily: "inherit", fontSize: 13.5 }}>
          <SegmentLabel segment={segment} showKey />
        </h3>
        <p className="desk-section-note">{total} students</p>
      </div>

      <span className="desk-stackbar" role="img" aria-label={LABEL_ORDER.map((l) => `${l} ${segment.label_counts[l] ?? 0}`).join(", ")}>
        {LABEL_ORDER.map((label) => {
          const count = segment.label_counts[label] ?? 0;
          if (count === 0 || total === 0) return null;
          return <span key={label} style={{ width: `${(count / total) * 100}%`, background: FILL[label] }} />;
        })}
      </span>

      <div className="desk-stackbar-legend">
        {LABEL_ORDER.map((label) => (
          <button
            key={`${segment.segment_key}-${label}`}
            type="button"
            onClick={() => onSegmentLabelClick(segment.segment_key, label)}
            style={{
              background: "none",
              border: 0,
              padding: 0,
              font: "inherit",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            {label} <b>{segment.label_counts[label] ?? 0}</b>{" "}
            <span style={{ color: "var(--paper-mid)" }}>
              ({(segment.label_percentages[label] ?? 0) * 100 > 0 ? ((segment.label_percentages[label] ?? 0) * 100).toFixed(1) : "0.0"}%)
            </span>
          </button>
        ))}
      </div>

      <div className="desk-row-between" style={{ borderTop: "1px solid rgba(29,37,25,0.14)", paddingTop: 8 }}>
        <div>
          <p className="desk-figure-label">Minimum satisfaction</p>
          <p className="desk-num" style={{ fontSize: 16 }}>
            {(segment.minimum_satisfaction * 100).toFixed(1)}%
          </p>
        </div>
        <button
          type="button"
          className="desk-chip"
          data-tone={segment.at_risk_count > 0 ? "attention" : undefined}
          onClick={() => onSegmentAtRiskClick(segment.segment_key)}
          style={{ cursor: "pointer" }}
        >
          {segment.at_risk_count} at risk
        </button>
      </div>
    </article>
  );
}
