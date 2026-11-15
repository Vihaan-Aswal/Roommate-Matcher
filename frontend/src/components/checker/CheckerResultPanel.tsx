import type { CheckerResponse, FactorTraceEntry } from "../../lib/apiClient";
import { factorPolarityIndicator, getSafeFactorLabel } from "../../lib/factorDisplay";
import { sanitizeReasonText } from "../../lib/privacySafeRender";
import { formatScorePercent } from "../../lib/resultPresentation";
import { StatusBadge } from "../StatusBadge";
import { InlineAlert } from "../InlineAlert";
import { EmptyState } from "../EmptyState";

interface CheckerResultPanelProps {
  result: CheckerResponse | null;
  isRunning: boolean;
  errorMessage: string | null;
}

function indicatorWord(entry: FactorTraceEntry): string {
  const mapped = factorPolarityIndicator(entry);
  if (mapped === "positive") return "Works in favour";
  if (mapped === "warning") return "Works against";
  return "Neutral";
}

export function CheckerResultPanel({
  result,
  isRunning,
  errorMessage,
}: CheckerResultPanelProps): JSX.Element {
  return (
    <section className="desk-stack-sm" aria-labelledby="checker-result-heading">
      <div className="desk-section-head">
        <h2 className="desk-section-title" id="checker-result-heading">
          The reading
        </h2>
        {result ? <p className="desk-section-note">{result.students.length} students</p> : null}
      </div>

      {isRunning ? (
        <div className="desk-stack-sm" aria-busy="true">
          <p className="desk-loading-note">Scoring the group</p>
          <div className="desk-skel" style={{ height: 92 }} />
        </div>
      ) : null}

      {errorMessage ? (
        <InlineAlert title="The checker could not finish" message={errorMessage} tone="error" />
      ) : null}

      {!result && !isRunning && !errorMessage ? (
        <EmptyState
          title="Nothing to read yet"
          line="Pick the students already in the room and one candidate. The reading shows the group score, the weakest student and what drove each factor."
        />
      ) : null}

      {result ? (
        <div className="desk-stack m-lift">
          <div className="desk-stack-sm">
            <div>
              <p className="desk-figure-label">Group compatibility score</p>
              <p className="desk-figure-value" style={{ fontSize: 32 }}>
                {formatScorePercent(result.group_score)}
              </p>
            </div>
            <div className="desk-row" style={{ gap: 10 }}>
              <StatusBadge value={result.group_label} />
              <p className="desk-help">
                At-risk students: {result.at_risk_students.join(", ") || "None"}
              </p>
            </div>
          </div>

          <div className="desk-stack-sm">
            {result.students.map((student) => (
              <article className="desk-panel desk-stack-sm" key={student.admission_number}>
                <div className="desk-row-between">
                  <p className="desk-mono" style={{ fontWeight: 500 }}>
                    {student.admission_number}
                  </p>
                  <div className="desk-row" style={{ gap: 8 }}>
                    <span className="desk-num">{formatScorePercent(student.satisfaction_score)}</span>
                    <StatusBadge value={student.satisfaction_label} />
                    {student.is_at_risk ? <StatusBadge value="At risk" /> : null}
                  </div>
                </div>

                <ul className="desk-stack-sm" style={{ gap: 4, margin: 0, padding: 0, listStyle: "none" }}>
                  {student.reasons.map((reason, index) => {
                    const sanitized = sanitizeReasonText(reason);
                    return (
                      <li
                        key={`${student.admission_number}-reason-${index}`}
                        className="desk-help"
                        style={{ maxWidth: "62ch" }}
                      >
                        {sanitized.text}
                      </li>
                    );
                  })}
                </ul>

                <div className="desk-stack-sm" style={{ gap: 3 }}>
                  {student.factor_trace.map((entry, index) => (
                    <p
                      key={`${student.admission_number}-${entry.template_id}-${index}`}
                      className="desk-mono"
                      style={{ fontSize: 11.5, color: "var(--paper-mid)" }}
                    >
                      <span style={{ color: "var(--paper-ink)" }}>{indicatorWord(entry)}</span>
                      {" · "}
                      {getSafeFactorLabel(entry.factor_key)} - {entry.factor_class}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
