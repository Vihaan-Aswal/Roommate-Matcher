import type { CheckerResponse, FactorTraceEntry } from "../../lib/apiClient";
import {
  factorPolarityIndicator,
  getSafeFactorLabel,
} from "../../lib/factorDisplay";
import { sanitizeReasonText } from "../../lib/privacySafeRender";
import { formatScorePercent } from "../../lib/resultPresentation";
import { StatusBadge } from "../StatusBadge";
import { InlineAlert } from "../InlineAlert";
import { CHECKER_DISCLAIMER } from "./CheckerSelectionPanel";

interface CheckerResultPanelProps {
  result: CheckerResponse | null;
  isRunning: boolean;
  errorMessage: string | null;
}

function indicator(entry: FactorTraceEntry): string {
  const mapped = factorPolarityIndicator(entry);
  if (mapped === "positive") {
    return "✅";
  }
  if (mapped === "warning") {
    return "⚠";
  }
  return "•";
}

export function CheckerResultPanel({
  result,
  isRunning,
  errorMessage,
}: CheckerResultPanelProps): JSX.Element {
  return (
    <div className="space-y-4 rounded-xl border border-border/80 bg-white/90 p-4">
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {CHECKER_DISCLAIMER}
      </p>

      {isRunning ? (
        <InlineAlert
          title="Running checker"
          message="Evaluating compatibility for selected students."
          tone="info"
        />
      ) : null}

      {errorMessage ? (
        <InlineAlert
          title="Checker request failed"
          message={errorMessage}
          tone="error"
        />
      ) : null}

      {!result && !isRunning && !errorMessage ? (
        <p className="text-sm text-muted-foreground">
          Select students and run compatibility report to view results.
        </p>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
            <p className="text-sm text-muted-foreground">
              Group compatibility score
            </p>
            <p className="text-xl font-semibold">
              {formatScorePercent(result.group_score)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge value={result.group_label} />
              <p className="text-sm text-muted-foreground">
                At-risk students: {result.at_risk_students.join(", ") || "None"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {result.students.map((student) => (
              <article
                key={student.admission_number}
                className="space-y-3 rounded-lg border border-border/70 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{student.admission_number}</p>
                  <div className="flex items-center gap-2">
                    <StatusBadge value={student.satisfaction_label} />
                    <StatusBadge
                      value={student.is_at_risk ? "Risk" : "Healthy"}
                    />
                    <span className="text-sm text-muted-foreground">
                      {formatScorePercent(student.satisfaction_score)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {student.reasons.map((reason, index) => {
                    const sanitized = sanitizeReasonText(reason);
                    return (
                      <p
                        key={`${student.admission_number}-reason-${index}`}
                        className="text-sm text-muted-foreground"
                      >
                        {sanitized.text}
                      </p>
                    );
                  })}
                </div>

                <div className="space-y-2 text-sm">
                  {student.factor_trace.map((entry, index) => (
                    <p
                      key={`${student.admission_number}-${entry.template_id}-${index}`}
                    >
                      {indicator(entry)} {getSafeFactorLabel(entry.factor_key)}{" "}
                      - {entry.factor_class}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
