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
    <div className="space-y-4">
      <section className="rounded-lg border border-border/70 bg-secondary/40 p-3 text-sm text-secondary-foreground">
        Context: room row {roomId ?? student.room_id}
      </section>
      <StudentDetailPanel student={student} />
    </div>
  );
}
