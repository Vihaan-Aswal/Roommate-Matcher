import type { SatisfactionLabel, SegmentOverview } from "../../../lib/apiClient";
import { segmentLabel } from "../../../lib/segmentLabel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Checkbox } from "../../ui/checkbox";

interface StudentResultsFiltersProps {
  segments: SegmentOverview[];
  selectedSegment: string;
  selectedLabel: "all" | SatisfactionLabel;
  atRiskOnly: boolean;
  onSegmentChange: (value: string) => void;
  onLabelChange: (value: "all" | SatisfactionLabel) => void;
  onAtRiskChange: (value: boolean) => void;
}

const LABELS: Array<"all" | SatisfactionLabel> = ["all", "Excellent", "Good", "Okay", "Poor"];

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
    <div className="desk-filterbar">
      <div className="desk-field" style={{ minWidth: 220 }}>
        <label className="desk-label" htmlFor="student-segment">
          Segment
        </label>
        <Select value={selectedSegment} onValueChange={onSegmentChange}>
          <SelectTrigger id="student-segment" className="desk-input desk-select-radix">
            <SelectValue placeholder="All segments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All segments</SelectItem>
            {segments.map((segment) => (
              <SelectItem key={segment.segment_key} value={segment.segment_key}>
                {segmentLabel(segment)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="desk-field">
        <span className="desk-label" id="label-filter-label">
          Satisfaction label
        </span>
        <div className="desk-seg" role="group" aria-labelledby="label-filter-label">
          {LABELS.map((label) => (
            <button
              key={label}
              type="button"
              aria-pressed={selectedLabel === label}
              onClick={() => onLabelChange(label)}
            >
              {label === "all" ? "All" : label}
            </button>
          ))}
        </div>
      </div>

      <label className="desk-check">
        <Checkbox
          className="desk-checkbox-radix"
          checked={atRiskOnly}
          onCheckedChange={(checked) => onAtRiskChange(checked === true)}
        />
        At risk only
      </label>
    </div>
  );
}
