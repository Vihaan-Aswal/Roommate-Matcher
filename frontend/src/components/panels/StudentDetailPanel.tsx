import type { FactorTraceEntry, SatisfactionLabel } from "../../lib/apiClient";
import {
  getSafeFactorLabel,
  factorPolarityIndicator,
} from "../../lib/factorDisplay";
import { sanitizeReasonText } from "../../lib/privacySafeRender";
import { formatScorePercent } from "../../lib/resultPresentation";
import { StatusBadge } from "../StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

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

function polaritySymbol(entry: FactorTraceEntry): string {
  const indicator = factorPolarityIndicator(entry);
  if (indicator === "positive") {
    return "✅";
  }
  if (indicator === "warning") {
    return "⚠";
  }
  return "•";
}

export function StudentDetailPanel({
  student,
}: StudentDetailPanelProps): JSX.Element {
  const sanitizedReasons = student.reasons.map(sanitizeReasonText);
  const redactionCount = sanitizedReasons.filter(
    (item) => item.wasRedacted,
  ).length;

  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-lg border border-border/70 bg-muted/30 p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Student summary
        </p>
        <p className="font-medium">
          {student.full_name} ({student.admission_number})
        </p>
        <p className="text-sm text-muted-foreground">Room {student.room_id}</p>
        <p className="text-sm text-muted-foreground">
          Roommates: {student.roommate_ids.join(", ") || "No roommates listed"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={student.satisfaction_label} />
          <span className="text-sm font-medium">
            {formatScorePercent(student.satisfaction_score)}
          </span>
          <StatusBadge value={student.is_at_risk ? "Risk" : "Healthy"} />
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Explanation reasons
        </p>
        <ul className="space-y-2 text-sm text-foreground">
          {sanitizedReasons.length === 0 ? (
            <li className="text-muted-foreground">No reasons returned.</li>
          ) : (
            sanitizedReasons.map((reason, index) => (
              <li
                key={`${student.admission_number}-reason-${index}`}
                className="rounded-md border border-border/70 bg-white p-2"
              >
                {reason.text}
              </li>
            ))
          )}
        </ul>
        {redactionCount > 0 ? (
          <p className="text-xs text-amber-700">
            {redactionCount} reason{redactionCount === 1 ? " was" : "s were"}{" "}
            privacy-redacted.
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Factor breakdown
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Factor</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Polarity</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Template</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {student.factor_trace.length === 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={5}>
                  No factor trace available.
                </TableCell>
              </TableRow>
            ) : (
              student.factor_trace.map((entry, index) => (
                <TableRow
                  key={`${student.admission_number}-${entry.template_id}-${index}`}
                >
                  <TableCell>{getSafeFactorLabel(entry.factor_key)}</TableCell>
                  <TableCell>{entry.factor_class}</TableCell>
                  <TableCell>
                    {polaritySymbol(entry)} {entry.polarity}
                  </TableCell>
                  <TableCell>{entry.claim_scope}</TableCell>
                  <TableCell>{entry.template_id}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
