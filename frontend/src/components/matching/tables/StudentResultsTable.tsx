import type { RunStudentRow } from "../../../lib/apiClient";
import {
  formatScorePercent,
  summarizeReasons,
} from "../../../lib/resultPresentation";
import { StatusBadge } from "../../StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import { studentResultsColumns } from "./studentResultsColumns";

interface StudentResultsTableProps {
  rows: RunStudentRow[];
  selectedStudentId: string | null;
  onStudentSelect: (admissionNumber: string) => void;
}

export function StudentResultsTable({
  rows,
  selectedStudentId,
  onStudentSelect,
}: StudentResultsTableProps): JSX.Element {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        No students match the current filters.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {studentResultsColumns.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((student) => {
          const reasonSummary = summarizeReasons(student.reasons);

          return (
            <TableRow
              key={student.admission_number}
              className="cursor-pointer"
              data-testid={`student-row-${student.admission_number}`}
              data-state={
                selectedStudentId === student.admission_number
                  ? "selected"
                  : undefined
              }
              onClick={() => onStudentSelect(student.admission_number)}
            >
              <TableCell className="font-medium">{student.admission_number}</TableCell>
              <TableCell>{student.full_name}</TableCell>
              <TableCell>{student.room_id}</TableCell>
              <TableCell>{formatScorePercent(student.satisfaction_score)}</TableCell>
              <TableCell>
                <StatusBadge value={student.satisfaction_label} />
              </TableCell>
              <TableCell>
                <StatusBadge value={student.is_at_risk ? "Risk" : "Healthy"} />
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  {reasonSummary.visibleReasons.map((reason, index) => (
                    <p
                      key={`${student.admission_number}-preview-${index}`}
                      className="line-clamp-1 text-sm text-muted-foreground"
                    >
                      {reason}
                    </p>
                  ))}
                  {reasonSummary.overflowCount > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      +{reasonSummary.overflowCount} more
                    </p>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
