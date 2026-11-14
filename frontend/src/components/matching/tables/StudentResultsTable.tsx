import type { RunStudentRow } from "../../../lib/apiClient";
import { formatScorePercent, summarizeReasons } from "../../../lib/resultPresentation";
import { StatusBadge } from "../../StatusBadge";

interface StudentResultsTableProps {
  rows: RunStudentRow[];
  selectedStudentId: string | null;
  onStudentSelect: (admissionNumber: string) => void;
}

/**
 * The student register: one line per student, sorted by admission number, with
 * the score bar carrying the label so a warden can scan for the floor.
 */
export function StudentResultsTable({
  rows,
  selectedStudentId,
  onStudentSelect,
}: StudentResultsTableProps): JSX.Element {
  if (rows.length === 0) {
    return (
      <p className="desk-table-empty">
        No students match these filters. Clear the label or at-risk filter to see the rest.
      </p>
    );
  }

  return (
    <div className="desk-table-wrap" data-stack="true">
      <table className="desk-table">
        <caption className="sr-only">Student results</caption>
        <thead>
          <tr>
            <th scope="col">Admission</th>
            <th scope="col">Student</th>
            <th scope="col">Room</th>
            <th scope="col">Score</th>
            <th scope="col">Label</th>
            <th scope="col">Reasons</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((student) => {
            const reasonSummary = summarizeReasons(student.reasons);
            return (
              <tr
                className="desk-clickrow"
                data-testid={`student-row-${student.admission_number}`}
                data-selected={selectedStudentId === student.admission_number}
                data-tone={student.is_at_risk ? "attention" : undefined}
                key={student.admission_number}
                onClick={() => onStudentSelect(student.admission_number)}
              >
                <td data-label="Admission">
                  <button
                    type="button"
                    className="desk-mono desk-link"
                    onClick={(event) => {
                      event.stopPropagation();
                      onStudentSelect(student.admission_number);
                    }}
                  >
                    {student.admission_number}
                  </button>
                </td>
                <td data-label="Student">{student.full_name}</td>
                <td data-label="Room">
                  <span className="desk-mono">{student.room_id}</span>
                </td>
                <td data-label="Score">
                  <span
                    className="desk-score"
                    data-tone={student.is_at_risk ? "attention" : undefined}
                  >
                    <span className="desk-score-num">{formatScorePercent(student.satisfaction_score)}</span>
                    <span className="desk-score-track" aria-hidden="true">
                      <span
                        style={{
                          width: `${Math.min(100, Math.max(0, student.satisfaction_score * 100))}%`,
                        }}
                      />
                    </span>
                  </span>
                </td>
                <td data-label="Label">
                  <span className="desk-row" style={{ gap: 6 }}>
                    <StatusBadge value={student.satisfaction_label} />
                    {student.is_at_risk ? (
                      <span className="desk-chip" data-tone="attention">
                        At risk
                      </span>
                    ) : null}
                  </span>
                </td>
                <td data-label="Reasons">
                  <div style={{ maxWidth: "48ch" }}>
                    {reasonSummary.visibleReasons.slice(0, 1).map((reason, index) => (
                      <p
                        className="desk-help desk-clamp"
                        key={`${student.admission_number}-preview-${index}`}
                        style={{ margin: 0 }}
                      >
                        {reason}
                      </p>
                    ))}
                    {student.reasons.length > 1 ? (
                      <p className="desk-list-meta" style={{ marginTop: 2 }}>
                        +{student.reasons.length - 1} more reason
                        {student.reasons.length - 1 === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
