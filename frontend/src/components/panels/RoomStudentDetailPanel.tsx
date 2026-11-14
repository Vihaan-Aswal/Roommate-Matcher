import { StudentDetailPanel, type StudentDetailPanelData } from "./StudentDetailPanel";

interface RoomStudentDetailPanelProps {
  roomId: string | null;
  student: StudentDetailPanelData;
}

export function RoomStudentDetailPanel({
  roomId,
  student,
}: RoomStudentDetailPanelProps): JSX.Element {
  return (
    <div className="desk-stack">
      <p className="desk-mono" style={{ color: "var(--paper-mid)" }}>
        Opened from room {roomId ?? student.room_id}
      </p>
      <StudentDetailPanel student={student} />
    </div>
  );
}
