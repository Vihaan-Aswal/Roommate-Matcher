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
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-white/80 p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <label htmlFor="room-segment" className="text-sm font-medium">
          Segment
        </label>
        <Select value={selectedSegment} onValueChange={onSegmentChange}>
          <SelectTrigger id="room-segment" className="w-[180px]">
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

      <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
        <Checkbox
          checked={needsReviewOnly}
          onCheckedChange={(checked) => onNeedsReviewChange(checked === true)}
        />
        Needs Review only
      </label>
    </div>
  );
}

