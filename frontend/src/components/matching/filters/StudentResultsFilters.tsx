import type {
  SatisfactionLabel,
  SegmentOverview,
} from "../../../lib/apiClient";
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
          <Select value={selectedSegment} onValueChange={onSegmentChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All segments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All segments</SelectItem>
              {segments.map((segment) => (
                <SelectItem key={segment.segment_key} value={segment.segment_key}>
                  {segment.segment_key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium">
          Label
          <Select
            value={selectedLabel}
            onValueChange={(value) => onLabelChange(value as "all" | SatisfactionLabel)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All labels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All labels</SelectItem>
              <SelectItem value="Excellent">Excellent</SelectItem>
              <SelectItem value="Good">Good</SelectItem>
              <SelectItem value="Okay">Okay</SelectItem>
              <SelectItem value="Poor">Poor</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
        <Checkbox
          checked={atRiskOnly}
          onCheckedChange={(checked) => onAtRiskChange(checked === true)}
        />
        At risk only
      </label>
    </div>
  );
}

