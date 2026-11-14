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
    <div className="desk-filterbar">
      <label className="desk-field" style={{ minWidth: 260 }}>
        <span className="desk-label">Run</span>
        <select
          className="desk-input desk-select"
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

      <label className="desk-field" style={{ minWidth: 200 }}>
        <span className="desk-label">Segment</span>
        <select
          className="desk-input desk-select"
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
