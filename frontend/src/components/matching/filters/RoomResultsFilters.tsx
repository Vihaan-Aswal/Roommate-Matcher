import type { SegmentOverview } from "../../../lib/apiClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Checkbox } from "../../ui/checkbox";

interface RoomResultsFiltersProps {
  segments: SegmentOverview[];
  selectedSegment: string;
  needsReviewOnly: boolean;
  onSegmentChange: (segmentKey: string) => void;
  onNeedsReviewChange: (enabled: boolean) => void;
}

export function RoomResultsFilters({
  segments,
  selectedSegment,
  needsReviewOnly,
  onSegmentChange,
  onNeedsReviewChange,
}: RoomResultsFiltersProps): JSX.Element {
  return (
    <div className="desk-filterbar">
      <div className="desk-field" style={{ minWidth: 220 }}>
        <label className="desk-label" htmlFor="room-segment">
          Segment
        </label>
        <Select value={selectedSegment} onValueChange={onSegmentChange}>
          <SelectTrigger id="room-segment" className="desk-input desk-select-radix">
            <SelectValue placeholder="Select segment" />
          </SelectTrigger>
          <SelectContent>
            {segments.map((segment) => (
              <SelectItem key={segment.segment_key} value={segment.segment_key}>
                {segment.segment_key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <label className="desk-check">
        <Checkbox
          className="desk-checkbox-radix"
          checked={needsReviewOnly}
          onCheckedChange={(checked) => onNeedsReviewChange(checked === true)}
        />
        Needs Review only
      </label>
    </div>
  );
}
