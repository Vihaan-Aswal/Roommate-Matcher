import { useState } from "react";
import { Check } from "lucide-react";

import { AdminPageHeader } from "../components/AdminPageHeader";
import { FileUploadPanel } from "../components/FileUploadPanel";
import { InlineAlert } from "../components/InlineAlert";
import { StatCard } from "../components/StatCard";
import {
  type StudentImportDiffResponse,
  type StudentImportApplyResponse,
  type RoomImportDiffResponse,
  type RoomImportApplyResponse,
} from "../lib/apiClient";
import { useAdminFormStatusQuery } from "../hooks/useAdminFormCollection";
import {
  usePreviewStudentUploadMutation,
  useApplyStudentUploadMutation,
  usePreviewRoomUploadMutation,
  useApplyRoomUploadMutation,
} from "../hooks/useAdminUploads";
import { useWorkspace } from "../providers/WorkspaceProvider";
import { segmentLabel } from "../lib/segmentLabel";
import { Button } from "../components/ui/button";
import { DiffPreviewPanel, type UnifiedDiffEntry } from "../components/DiffPreviewPanel";

type UploadStep = "select" | "preview" | "applied";

const STUDENT_COLUMNS = [
  "admission_number",
  "full_name",
  "gender",
  "year_group",
  "ac_type",
  "room_size",
  "dob",
  "phone_number",
];

const ROOM_COLUMNS = ["room_id", "segment_key", "capacity"];

function AppliedStamp({
  title,
  counts,
  onReset,
}: {
  title: string;
  counts: { inserted: number; updated: number; softDeleted: number; unchanged: number };
  onReset: () => void;
}): JSX.Element {
  return (
    <section className="desk-sheet desk-stack-sm m-stamp">
      <div className="desk-row" style={{ gap: 8 }}>
        <span
          className="desk-row"
          style={{ gap: 6, color: "var(--wax)", fontFamily: '"IBM Plex Mono MM", monospace', fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase" }}
        >
          <Check size={14} strokeWidth={2.2} aria-hidden="true" />
          Step 3 of 3 · applied
        </span>
      </div>
      <h2 className="desk-section-title">{title}</h2>
      <div className="desk-figures" style={{ borderTop: "1px solid rgba(29,37,25,0.22)" }}>
        <StatCard label="Inserted" value={counts.inserted} />
        <StatCard label="Updated" value={counts.updated} />
        <StatCard label="Removed" value={counts.softDeleted} />
        <StatCard label="Unchanged" value={counts.unchanged} />
      </div>
      <div className="desk-row">
        <Button variant="outline" size="sm" onClick={onReset}>
          Upload another file
        </Button>
      </div>
    </section>
  );
}

export function AdminStudentsData(): JSX.Element {
  const { workspaceId, workspaceName } = useWorkspace();
  const formStatusQuery = useAdminFormStatusQuery(workspaceId);

  const previewStudents = usePreviewStudentUploadMutation(workspaceId!);
  const applyStudents = useApplyStudentUploadMutation(workspaceId!);
  const previewRooms = usePreviewRoomUploadMutation(workspaceId!);
  const applyRooms = useApplyRoomUploadMutation(workspaceId!);

  const [studentStep, setStudentStep] = useState<UploadStep>("select");
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [studentDiff, setStudentDiff] = useState<StudentImportDiffResponse | null>(null);
  const [studentResult, setStudentResult] = useState<StudentImportApplyResponse | null>(null);

  const [roomStep, setRoomStep] = useState<UploadStep>("select");
  const [roomFile, setRoomFile] = useState<File | null>(null);
  const [roomDiff, setRoomDiff] = useState<RoomImportDiffResponse | null>(null);
  const [roomResult, setRoomResult] = useState<RoomImportApplyResponse | null>(null);

  return (
    <section className="desk-stack">
      <AdminPageHeader
        title="Students & Data"
        workspace={workspaceName ?? undefined}
        meta="Students file · rooms file"
        description="Two files make a workspace runnable. Both are read into a preview first, so you can see every insert, update and removal before anything is written."
      />

      <div className="desk-cols">
        <div className="desk-stack">

          {studentStep === "select" && (
            <FileUploadPanel
              title="Master Students CSV"
              description="The roster: who lives in this workspace, with the four boundary fields that decide their segment."
              buttonLabel="Upload Students"
              columns={STUDENT_COLUMNS}
              isUploading={previewStudents.isPending}
              onUpload={async (file) => {
                setStudentFile(file);
                const diff = await previewStudents.mutateAsync(file);
                setStudentDiff(diff);
                setStudentStep("preview");
              }}
            />
          )}

          {studentStep === "preview" && studentDiff && studentFile && (
            <DiffPreviewPanel
              title="Students Upload Preview"
              toInsert={studentDiff.to_insert}
              toUpdate={studentDiff.to_update}
              toSoftDelete={studentDiff.to_soft_delete}
              unchanged={studentDiff.unchanged}
              validCsvRows={studentDiff.valid_csv_rows}
              validationErrors={studentDiff.validation_errors}
              workspaceWarnings={studentDiff.warnings}
              isApplying={applyStudents.isPending}
              onCancel={() => {
                setStudentStep("select");
                setStudentDiff(null);
                setStudentFile(null);
              }}
              onConfirm={async () => {
                const res = await applyStudents.mutateAsync(studentFile);
                setStudentResult(res);
                setStudentStep("applied");
              }}
              diffEntries={studentDiff.diff_entries.map((e) => ({
                identifier: e.admission_number,
                name: e.full_name,
                action: e.action,
                changes: e.changes,
                warnings: e.warnings,
              }))}
            />
          )}

          {studentStep === "applied" && studentResult && (
            <AppliedStamp
              title="Students Applied Successfully"
              counts={{
                inserted: studentResult.inserted,
                updated: studentResult.updated,
                softDeleted: studentResult.soft_deleted,
                unchanged: studentResult.unchanged,
              }}
              onReset={() => {
                setStudentStep("select");
                setStudentFile(null);
                setStudentDiff(null);
                setStudentResult(null);
              }}
            />
          )}

          {previewStudents.isError && studentStep === "select" && (
            <InlineAlert title="The file was not read" message={previewStudents.error.message} tone="error" />
          )}
          {applyStudents.isError && studentStep === "preview" && (
            <InlineAlert
              title="The file was not applied"
              message={applyStudents.error.message}
              tone="error"
            />
          )}
        </div>

        <div className="desk-stack">

          {roomStep === "select" && (
            <FileUploadPanel
              title="Rooms CSV"
              description="Room ids, the segment each room belongs to, and how many beds it holds."
              buttonLabel="Upload Rooms"
              columns={ROOM_COLUMNS}
              isUploading={previewRooms.isPending}
              onUpload={async (file) => {
                setRoomFile(file);
                const diff = await previewRooms.mutateAsync(file);
                setRoomDiff(diff);
                setRoomStep("preview");
              }}
            />
          )}

          {roomStep === "preview" && roomDiff && roomFile && (
            <DiffPreviewPanel
              title="Rooms Upload Preview"
              toInsert={roomDiff.to_insert}
              toUpdate={roomDiff.to_update}
              toSoftDelete={roomDiff.to_soft_delete}
              unchanged={roomDiff.unchanged}
              validCsvRows={roomDiff.valid_csv_rows}
              validationErrors={roomDiff.validation_errors}
              workspaceWarnings={roomDiff.warnings}
              isApplying={applyRooms.isPending}
              onCancel={() => {
                setRoomStep("select");
                setRoomDiff(null);
                setRoomFile(null);
              }}
              onConfirm={async () => {
                const res = await applyRooms.mutateAsync(roomFile);
                setRoomResult(res);
                setRoomStep("applied");
              }}
              diffEntries={roomDiff.diff_entries.map((e) => ({
                identifier: e.room_id,
                name: segmentLabel({ segment_key: e.segment_key }),
                action: e.action,
                changes: e.changes,
                warnings: e.warnings,
              }))}
            />
          )}

          {roomStep === "applied" && roomResult && (
            <AppliedStamp
              title="Rooms Applied Successfully"
              counts={{
                inserted: roomResult.inserted,
                updated: roomResult.updated,
                softDeleted: roomResult.soft_deleted,
                unchanged: roomResult.unchanged,
              }}
              onReset={() => {
                setRoomStep("select");
                setRoomFile(null);
                setRoomDiff(null);
                setRoomResult(null);
              }}
            />
          )}

          {previewRooms.isError && roomStep === "select" && (
            <InlineAlert title="The file was not read" message={previewRooms.error.message} tone="error" />
          )}
          {applyRooms.isError && roomStep === "preview" && (
            <InlineAlert title="The file was not applied" message={applyRooms.error.message} tone="error" />
          )}
        </div>
      </div>

      <div className="desk-section">
        <div className="desk-section-head">
          <h2 className="desk-section-title">Response snapshot</h2>
        </div>

        {formStatusQuery.isLoading ? (
          <div className="desk-stack-sm" aria-busy="true">
            <p className="desk-loading-note">Counting responses</p>
            <div className="desk-skel" style={{ height: 76 }} />
          </div>
        ) : null}

        {formStatusQuery.isError ? (
          <InlineAlert
            title="Response counts are unavailable"
            message={
              formStatusQuery.error instanceof Error
                ? formStatusQuery.error.message
                : "Form status request failed."
            }
            tone="error"
          />
        ) : null}

        {formStatusQuery.data ? (
          <div className="desk-figures">
            <StatCard label="Total Students" value={formStatusQuery.data.total_students} hint="on the roster" />
            <StatCard label="Valid Responses" value={formStatusQuery.data.valid_responses} hint="counted in matching" />
            <StatCard label="Invalid Responses" value={formStatusQuery.data.invalid_responses} hint="rejected by validation" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
