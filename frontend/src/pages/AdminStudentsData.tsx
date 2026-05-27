import { useState } from "react";

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
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { DiffPreviewPanel, type UnifiedDiffEntry } from "../components/DiffPreviewPanel";

type UploadStep = "select" | "preview" | "applied";

export function AdminStudentsData(): JSX.Element {
  const { workspaceId } = useWorkspace();
  const formStatusQuery = useAdminFormStatusQuery();

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
    <section className="space-y-6">
      <AdminPageHeader
        title="Students & Data"
        description="Upload master students and room inventory CSV files. Upload responses are authoritative and dependent views are automatically refreshed after each upload."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* -- STUDENTS UPLOAD -- */}
        <div className="space-y-4">
          {studentStep === "select" && (
            <FileUploadPanel
              title="Master Students CSV"
              description="Upload the canonical students file with exact column names."
              buttonLabel="Upload Students"
              isUploading={previewStudents.isPending}
              onFileSelected={(file) => {
                setStudentFile(file ?? null);
              }}
              onUpload={async (file) => {
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
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-green-800">Students Applied Successfully</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                  <StatCard label="Inserted" value={studentResult.inserted} />
                  <StatCard label="Updated" value={studentResult.updated} />
                  <StatCard label="Removed" value={studentResult.soft_deleted} />
                  <StatCard label="Unchanged" value={studentResult.unchanged} />
                </div>
                <Button variant="outline" onClick={() => {
                  setStudentStep("select");
                  setStudentFile(null);
                  setStudentDiff(null);
                  setStudentResult(null);
                }}>
                  Upload Another File
                </Button>
              </CardContent>
            </Card>
          )}

          {previewStudents.isError && studentStep === "select" && (
            <InlineAlert title="Preview Failed" message={previewStudents.error.message} tone="error" />
          )}
          {applyStudents.isError && studentStep === "preview" && (
            <InlineAlert title="Apply Failed" message={applyStudents.error.message} tone="error" />
          )}
        </div>

        {/* -- ROOMS UPLOAD -- */}
        <div className="space-y-4">
          {roomStep === "select" && (
            <FileUploadPanel
              title="Rooms CSV"
              description="Upload room IDs and capacities per segment."
              buttonLabel="Upload Rooms"
              isUploading={previewRooms.isPending}
              onFileSelected={(file) => {
                setRoomFile(file ?? null);
              }}
              onUpload={async (file) => {
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
                name: e.segment_key,
                action: e.action,
                changes: e.changes,
                warnings: e.warnings,
              }))}
            />
          )}

          {roomStep === "applied" && roomResult && (
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-green-800">Rooms Applied Successfully</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                  <StatCard label="Inserted" value={roomResult.inserted} />
                  <StatCard label="Updated" value={roomResult.updated} />
                  <StatCard label="Removed" value={roomResult.soft_deleted} />
                  <StatCard label="Unchanged" value={roomResult.unchanged} />
                </div>
                <Button variant="outline" onClick={() => {
                  setRoomStep("select");
                  setRoomFile(null);
                  setRoomDiff(null);
                  setRoomResult(null);
                }}>
                  Upload Another File
                </Button>
              </CardContent>
            </Card>
          )}

          {previewRooms.isError && roomStep === "select" && (
            <InlineAlert title="Preview Failed" message={previewRooms.error.message} tone="error" />
          )}
          {applyRooms.isError && roomStep === "preview" && (
            <InlineAlert title="Apply Failed" message={applyRooms.error.message} tone="error" />
          )}
        </div>
      </div>

      {/* -- FORM VALIDATION SNAPSHOT -- */}
      <Card className="border-border/80 bg-white/90">
        <CardHeader>
          <CardTitle className="text-lg">Form Validation Snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          {formStatusQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading form status...</p>
          ) : null}
          {formStatusQuery.isError ? (
            <InlineAlert
              title="Unable to load form stats"
              message={
                formStatusQuery.error instanceof Error
                  ? formStatusQuery.error.message
                  : "Form status request failed."
              }
              tone="error"
            />
          ) : null}

          {formStatusQuery.data ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Total Students" value={formStatusQuery.data.total_students} />
              <StatCard label="Valid Responses" value={formStatusQuery.data.valid_responses} />
              <StatCard label="Invalid Responses" value={formStatusQuery.data.invalid_responses} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
