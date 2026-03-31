import type { MatchingRunHistoryRow } from "../../lib/apiClient";

interface RunSegmentSelectorProps {
  runs: MatchingRunHistoryRow[];
  selectedRunId: string;
  selectedSegment: string;
  onRunChange: (runId: string) => void;
  onSegmentChange: (segment: string) => void;
  segmentOptions: string[];
}

export function RunSegmentSelector({
  runs,
  selectedRunId,
  selectedSegment,
  onRunChange,
  onSegmentChange,
  segmentOptions,
}: RunSegmentSelectorProps): JSX.Element {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-white/80 p-4 lg:flex-row lg:items-center">
      <label className="flex items-center gap-2 text-sm font-medium">
        Run
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedRunId}
          onChange={(event) => onRunChange(event.target.value)}
        >
          {runs.map((run) => (
            <option key={run.run_id} value={run.run_id}>
              {run.run_id}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm font-medium">
        Segment
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedSegment}
          onChange={(event) => onSegmentChange(event.target.value)}
        >
          <option value="all">All segments</option>
          {segmentOptions.map((segmentKey) => (
            <option key={segmentKey} value={segmentKey}>
              {segmentKey}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
