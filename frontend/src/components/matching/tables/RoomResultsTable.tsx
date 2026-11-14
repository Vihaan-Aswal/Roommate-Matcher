import type { RunRoomRow } from "../../../lib/apiClient";
import { formatScorePercent, roomHealthLabel } from "../../../lib/resultPresentation";
import { StatusBadge } from "../../StatusBadge";

interface RoomResultsTableProps {
  rows: RunRoomRow[];
  selectedRoomId: string | null;
  onRoomSelect: (roomId: string) => void;
  onStudentSelect: (admissionNumber: string) => void;
}

function sortedPairEntries(pairScores: Record<string, number>): [string, number][] {
  return Object.entries(pairScores).sort(([left], [right]) => left.localeCompare(right));
}

/**
 * The room register. Each room is a record with a header line and its students
 * underneath — not a table cell holding a table.
 */
export function RoomResultsTable({
  rows,
  selectedRoomId,
  onRoomSelect,
  onStudentSelect,
}: RoomResultsTableProps): JSX.Element {
  if (rows.length === 0) {
    return (
      <p className="desk-table-empty">
        No rooms match this filter. Clear “Needs review only” to see every room in the segment.
      </p>
    );
  }

  return (
    <div className="desk-reg">
      <div className="desk-reg-head desk-reg-header" aria-hidden="true">
        <span>Room ID</span>
        <span>Group score</span>
        <span>Health</span>
        <span />
      </div>
      <ol className="desk-reg-body">
        {rows.map((room) => {
          const atRisk = room.needs_review;
          return (
            <li
              className="desk-reg-row"
              data-selected={selectedRoomId === room.room_id}
              data-tone={atRisk ? "attention" : undefined}
              key={room.room_id}
            >
              <div className="desk-reg-head">
                <div className="desk-reg-id">
                  <p className="desk-mono" style={{ fontSize: 15, fontWeight: 500 }}>
                    {room.room_id}
                  </p>
                  <p className="desk-list-meta">{room.room_size}-bed</p>
                </div>

                <div className="desk-reg-score">
                  <span className="desk-num" style={{ fontSize: 15, minWidth: 62, textAlign: "right" }}>
                    {formatScorePercent(room.group_score)}
                  </span>
                  <span className="desk-score-track" aria-hidden="true">
                    <span style={{ width: `${Math.min(100, Math.max(0, room.group_score * 100))}%` }} />
                  </span>
                </div>

                <div className="desk-reg-health">
                  <StatusBadge value={roomHealthLabel(room.needs_review)} />
                </div>

                <button
                  type="button"
                  className="desk-btn desk-btn-quiet desk-btn-sm"
                  onClick={() => onRoomSelect(room.room_id)}
                  aria-pressed={selectedRoomId === room.room_id}
                >
                  {selectedRoomId === room.room_id ? "Selected" : "Select room"}
                </button>
              </div>

              <ul className="desk-reg-students">
                {room.assigned_students.map((student) => {
                  const pairs = sortedPairEntries(student.pair_scores_with_roommates);
                  return (
                    <li key={student.admission_number}>
                      <button
                        className="desk-link"
                        style={{ fontSize: 13.5 }}
                        type="button"
                        onClick={() => onStudentSelect(student.admission_number)}
                      >
                        {student.full_name}
                      </button>
                      <span
                        className="desk-mono"
                        style={{ color: "var(--paper-mid)", marginLeft: 8, fontSize: 11 }}
                      >
                        {student.admission_number}
                      </span>
                      {pairs.length > 0 ? (
                        <span className="desk-reg-pairs">
                          {pairs.map(([roommateId, score]) => (
                            <span
                              className="desk-reg-pair"
                              key={`${student.admission_number}-${roommateId}`}
                            >
                              <span className="desk-mono" style={{ fontSize: 10.5 }}>
                                {roommateId}
                              </span>
                              <span className="desk-num" style={{ fontSize: 11 }}>
                                {formatScorePercent(score)}
                              </span>
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
