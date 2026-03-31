import type { RunRoomRow } from "../../../lib/apiClient";
import {
  formatScorePercent,
  roomHealthLabel,
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
import { roomResultsColumns } from "./roomResultsColumns";

interface RoomResultsTableProps {
  rows: RunRoomRow[];
  selectedRoomId: string | null;
  onRoomSelect: (roomId: string) => void;
  onStudentSelect: (admissionNumber: string) => void;
}

function sortedPairEntries(
  pairScores: Record<string, number>,
): [string, number][] {
  return Object.entries(pairScores).sort(([left], [right]) =>
    left.localeCompare(right),
  );
}

export function RoomResultsTable({
  rows,
  selectedRoomId,
  onRoomSelect,
  onStudentSelect,
}: RoomResultsTableProps): JSX.Element {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        No room results available for this filter.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {roomResultsColumns.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((room) => (
          <TableRow
            key={room.room_id}
            className="cursor-pointer"
            data-state={
              selectedRoomId === room.room_id ? "selected" : undefined
            }
            onClick={() => onRoomSelect(room.room_id)}
          >
            <TableCell className="font-medium">{room.room_id}</TableCell>
            <TableCell>{room.room_size}</TableCell>
            <TableCell>
              <div className="space-y-2">
                {room.assigned_students.map((student) => (
                  <div
                    key={student.admission_number}
                    className="rounded-md border border-border/70 bg-muted/40 p-2"
                  >
                    <button
                      className="text-left text-sm font-medium text-primary hover:underline"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onStudentSelect(student.admission_number);
                      }}
                    >
                      {student.full_name} ({student.admission_number})
                    </button>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {sortedPairEntries(
                        student.pair_scores_with_roommates,
                      ).map(([roommateId, score]) => (
                        <span
                          key={`${student.admission_number}-${roommateId}`}
                          className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                        >
                          {roommateId}: {formatScorePercent(score)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </TableCell>
            <TableCell>
              <div className="space-y-1">
                <p className="font-medium">
                  {formatScorePercent(room.group_score)}
                </p>
                <p className="text-xs text-muted-foreground">
                  raw {room.group_score.toFixed(4)}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <StatusBadge value={roomHealthLabel(room.needs_review)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
