import type { SegmentOverview, SegmentStudentPreferenceRow } from "../../lib/apiClient";
import { segmentLabel } from "../../lib/segmentLabel";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
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
    <section className="desk-stack-sm" aria-labelledby="checker-selection-heading">
      <div className="desk-section-head">
        <h2 className="desk-section-title" id="checker-selection-heading">
          Build the group
        </h2>
        <p className="desk-section-note">
          {roomSize === null ? "Room size unknown" : `${roomSize}-bed room`}
        </p>
      </div>

      <label className="desk-field">
        <span className="desk-label">Segment</span>
        <Select value={selectedSegment} onValueChange={onSegmentChange}>
          <SelectTrigger className="desk-input desk-select-radix">
            <SelectValue placeholder="Select segment" />
          </SelectTrigger>
          <SelectContent>
            {segments.map((segment) => (
              <SelectItem key={segment.segment_key} value={segment.segment_key}>
                {segmentLabel(segment)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <CheckerStudentsList
        searchTerm={searchTerm}
        selectedCandidateId={selectedCandidateId}
        selectedExistingIds={selectedExistingIds}
        students={students}
        onCandidateChange={onCandidateChange}
        onSearchTermChange={onSearchTermChange}
        onToggleExisting={onToggleExisting}
      />

      <div className="desk-stack-sm" style={{ gap: 6 }}>
        <Button className="desk-btn-block" disabled={!canRun || isRunning} onClick={onRun}>
          {isRunning ? "Running…" : "Run compatibility report"}
        </Button>
        <p className="desk-help" aria-live="polite">
          {validationMessage}
        </p>
      </div>
    </section>
  );
}
