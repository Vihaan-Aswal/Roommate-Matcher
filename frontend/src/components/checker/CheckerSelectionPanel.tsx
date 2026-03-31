import type {
  SegmentOverview,
  SegmentStudentPreferenceRow,
} from "../../lib/apiClient";
import { Button } from "../ui/button";
import { Select } from "../ui/select";
import { CheckerStudentsList } from "./CheckerStudentsList";

export const CHECKER_DISCLAIMER =
  "Manual Checker is advisory only. Running this report does not modify saved assignments or matching runs.";

interface CheckerSelectionPanelProps {
  segments: SegmentOverview[];
  selectedSegment: string;
  roomSize: number | null;
  students: SegmentStudentPreferenceRow[];
  selectedExistingIds: string[];
  selectedCandidateId: string | null;
  searchTerm: string;
  canRun: boolean;
  validationMessage: string;
  isRunning: boolean;
  onSegmentChange: (segment: string) => void;
  onSearchTermChange: (value: string) => void;
  onToggleExisting: (admissionNumber: string) => void;
  onCandidateChange: (admissionNumber: string | null) => void;
  onRun: () => void;
}

export function CheckerSelectionPanel({
  segments,
  selectedSegment,
  roomSize,
  students,
  selectedExistingIds,
  selectedCandidateId,
  searchTerm,
  canRun,
  validationMessage,
  isRunning,
  onSegmentChange,
  onSearchTermChange,
  onToggleExisting,
  onCandidateChange,
  onRun,
}: CheckerSelectionPanelProps): JSX.Element {
  return (
    <div className="space-y-4 rounded-xl border border-border/80 bg-white/90 p-4">
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {CHECKER_DISCLAIMER}
      </p>

      <label className="block space-y-1 text-sm font-medium">
        Segment
        <Select
          value={selectedSegment}
          onChange={(event) => onSegmentChange(event.target.value)}
        >
          {segments.map((segment) => (
            <option key={segment.segment_key} value={segment.segment_key}>
              {segment.segment_key}
            </option>
          ))}
        </Select>
      </label>

      <p className="text-sm text-muted-foreground">
        Room size: {roomSize ?? "Not resolved yet"}
      </p>

      <CheckerStudentsList
        searchTerm={searchTerm}
        selectedCandidateId={selectedCandidateId}
        selectedExistingIds={selectedExistingIds}
        students={students}
        onCandidateChange={onCandidateChange}
        onSearchTermChange={onSearchTermChange}
        onToggleExisting={onToggleExisting}
      />

      <div className="space-y-2">
        <Button
          className="w-full"
          disabled={!canRun || isRunning}
          variant="accent"
          onClick={onRun}
        >
          {isRunning ? "Running..." : "Run compatibility report"}
        </Button>
        <p className="text-xs text-muted-foreground">{validationMessage}</p>
      </div>
    </div>
  );
}
