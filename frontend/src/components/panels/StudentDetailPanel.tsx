import type { FactorTraceEntry, SatisfactionLabel } from "../../lib/apiClient";
import { getSafeFactorLabel, factorPolarityIndicator } from "../../lib/factorDisplay";
import { sanitizeReasonText } from "../../lib/privacySafeRender";
import { formatScorePercent } from "../../lib/resultPresentation";
import { StatusBadge } from "../StatusBadge";

export interface StudentDetailPanelData {
  admission_number: string;
  full_name: string;
  room_id: string;
  roommate_ids: string[];
  satisfaction_score: number;
  satisfaction_label: SatisfactionLabel;
  is_at_risk: boolean;
  reasons: string[];
  factor_trace: FactorTraceEntry[];
}

interface StudentDetailPanelProps {
  student: StudentDetailPanelData;
}

function polarityWord(entry: FactorTraceEntry): string {
  const indicator = factorPolarityIndicator(entry);
  if (indicator === "positive") return "Works in favour";
  if (indicator === "warning") return "Works against";
  return "Neutral";
}

export function StudentDetailPanel({ student }: StudentDetailPanelProps): JSX.Element {
  const sanitizedReasons = student.reasons.map(sanitizeReasonText);
  const redactionCount = sanitizedReasons.filter((item) => item.wasRedacted).length;

  return (
    <div className="desk-stack" style={{ gap: 18 }}>
      <section className="desk-stack-sm">
        <p className="desk-overline">Student summary</p>
        <p style={{ fontWeight: 600, fontSize: 15 }}>
          {`${student.full_name} (${student.admission_number})`}
        </p>
        <dl className="desk-kv">
          <dt>Room</dt>
          <dd className="desk-mono">{student.room_id}</dd>
          <dt>Roommates</dt>
          <dd className="desk-mono">{student.roommate_ids.join(", ") || "No roommates listed"}</dd>
          <dt>Score</dt>
          <dd>
            <span className="desk-row" style={{ gap: 10 }}>
              <span className="desk-num">{formatScorePercent(student.satisfaction_score)}</span>
              <StatusBadge value={student.satisfaction_label} />
              {student.is_at_risk ? <StatusBadge value="At risk" /> : null}
            </span>
          </dd>
        </dl>
      </section>

      <section className="desk-stack-sm">
        <div className="desk-section-head" style={{ paddingBottom: 4 }}>
          <p className="desk-overline">Explanation reasons</p>
          <p className="desk-section-note">Reasons, never raw answers</p>
        </div>
        {sanitizedReasons.length === 0 ? (
          <p className="desk-help">No reasons were returned for this student.</p>
        ) : (
          <ul className="desk-list" style={{ borderTop: 0 }}>
            {sanitizedReasons.map((reason, index) => (
              <li
                key={`${student.admission_number}-reason-${index}`}
                className="desk-list-row"
                style={{ alignItems: "flex-start" }}
              >
                <span className="desk-list-main" style={{ fontSize: 13.5, lineHeight: 1.55 }}>
                  {reason.text}
                </span>
              </li>
            ))}
          </ul>
        )}
        {redactionCount > 0 ? (
          <p className="desk-help">
            {redactionCount} reason{redactionCount === 1 ? " was" : "s were"} privacy-redacted before
            display.
          </p>
        ) : null}
      </section>

      <section className="desk-stack-sm">
        <div className="desk-section-head" style={{ paddingBottom: 4 }}>
          <p className="desk-overline">Factor breakdown</p>
          <p className="desk-section-note">{student.factor_trace.length} factors</p>
        </div>
        {student.factor_trace.length === 0 ? (
          <p className="desk-help">No factor trace available.</p>
        ) : (
          <div className="desk-table-wrap">
            <table className="desk-table">
              <caption className="sr-only">Factor trace</caption>
              <thead>
                <tr>
                  <th scope="col">Factor</th>
                  <th scope="col">Reading</th>
                  <th scope="col">Class</th>
                </tr>
              </thead>
              <tbody>
                {student.factor_trace.map((entry, index) => (
                  <tr key={`${student.admission_number}-${entry.template_id}-${index}`}>
                    <td>{getSafeFactorLabel(entry.factor_key)}</td>
                    <td>
                      <span className="desk-row" style={{ gap: 6 }}>
                        <span
                          className="desk-dot"
                          data-tone={
                            factorPolarityIndicator(entry) === "positive"
                              ? "mark"
                              : factorPolarityIndicator(entry) === "warning"
                                ? "attention"
                                : "quiet"
                          }
                          aria-hidden="true"
                        />
                        {polarityWord(entry)}
                      </span>
                    </td>
                    <td className="desk-mono" style={{ color: "var(--paper-mid)" }}>
                      {entry.factor_class}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
