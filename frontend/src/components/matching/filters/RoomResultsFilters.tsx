import type { SegmentOverview } from "../../../lib/apiClient";

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
        <select
          id="room-segment"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedSegment}
          onChange={(event) => onSegmentChange(event.target.value)}
        >
          {segments.map((segment) => (
            <option key={segment.segment_key} value={segment.segment_key}>
              {segment.segment_key}
            </option>
          ))}
        </select>
      </div>

      <label className="inline-flex items-center gap-2 text-sm font-medium">
        <input
          checked={needsReviewOnly}
          className="h-4 w-4 rounded border-input"
          type="checkbox"
          onChange={(event) => onNeedsReviewChange(event.target.checked)}
        />
        Needs Review only
      </label>
    </div>
  );
}
