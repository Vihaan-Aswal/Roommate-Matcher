import type { SatisfactionLabel, SegmentOverview } from "../../../lib/apiClient";

interface StudentResultsFiltersProps {
  segments: SegmentOverview[];
  selectedSegment: string;
  selectedLabel: "all" | SatisfactionLabel;
  atRiskOnly: boolean;
  onSegmentChange: (value: string) => void;
  onLabelChange: (value: "all" | SatisfactionLabel) => void;
  onAtRiskChange: (value: boolean) => void;
}

export function StudentResultsFilters({
  segments,
  selectedSegment,
  selectedLabel,
  atRiskOnly,
  onSegmentChange,
  onLabelChange,
  onAtRiskChange,
}: StudentResultsFiltersProps): JSX.Element {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-white/80 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:items-center">
        <label className="flex items-center gap-2 text-sm font-medium">
          Segment
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={selectedSegment}
            onChange={(event) => onSegmentChange(event.target.value)}
          >
            <option value="all">All segments</option>
            {segments.map((segment) => (
              <option key={segment.segment_key} value={segment.segment_key}>
                {segment.segment_key}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium">
          Label
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={selectedLabel}
            onChange={(event) =>
              onLabelChange(event.target.value as "all" | SatisfactionLabel)
            }
          >
            <option value="all">All labels</option>
            <option value="Excellent">Excellent</option>
            <option value="Good">Good</option>
            <option value="Okay">Okay</option>
            <option value="Poor">Poor</option>
          </select>
        </label>
      </div>

      <label className="inline-flex items-center gap-2 text-sm font-medium">
        <input
          checked={atRiskOnly}
          className="h-4 w-4 rounded border-input"
          type="checkbox"
          onChange={(event) => onAtRiskChange(event.target.checked)}
        />
        At risk only
      </label>
    </div>
  );
}
