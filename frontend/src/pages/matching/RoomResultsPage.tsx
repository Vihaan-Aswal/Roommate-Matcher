import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { AdminPageHeader } from "../../components/AdminPageHeader";
import DataWarningBanner from "../../components/DataWarningBanner";
import { InlineAlert } from "../../components/InlineAlert";
import { RoomResultsFilters } from "../../components/matching/filters/RoomResultsFilters";
import { RoomResultsTable } from "../../components/matching/tables/RoomResultsTable";
import { DetailSidePanelShell } from "../../components/panels/DetailSidePanelShell";
import { RoomStudentDetailPanel } from "../../components/panels/RoomStudentDetailPanel";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { useAdminSegmentsQuery } from "../../hooks/useAdminSegments";
import { useAssignmentsExportMutation } from "../../hooks/useAssignmentsExportMutation";
import { useRunRoomsQuery } from "../../hooks/useRunRoomsQuery";
import { useRunStudentsQuery } from "../../hooks/useRunStudentsQuery";

export function RoomResultsPage(): JSX.Element {
  const { workspaceId, runId } = useParams<{ workspaceId: string; runId: string }>();
  if (!workspaceId) throw new Error("workspaceId is required");
  const [searchParams, setSearchParams] = useSearchParams();
  const segmentsQuery = useAdminSegmentsQuery(workspaceId);
  const exportMutation = useAssignmentsExportMutation(workspaceId);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const selectedSegment = searchParams.get("segment");
  const needsReviewOnly = searchParams.get("needsReview") === "1";
  const selectedStudent = searchParams.get("student");

  useEffect(() => {
    const segments = segmentsQuery.data?.segments ?? [];
    if (selectedSegment || segments.length === 0) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.set("segment", segments[0].segment_key);
    if (!next.has("needsReview")) {
      next.set("needsReview", "0");
    }
    setSearchParams(next, { replace: true });
  }, [
    searchParams,
    segmentsQuery.data?.segments,
    selectedSegment,
    setSearchParams,
  ]);

  const roomsQuery = useRunRoomsQuery(workspaceId, runId ?? "", selectedSegment ?? "");
  const studentsQuery = useRunStudentsQuery(workspaceId, runId ?? "", selectedSegment ?? "");

  const rooms = roomsQuery.data?.rooms ?? [];
  const filteredRooms = useMemo(
    () => (needsReviewOnly ? rooms.filter((room) => room.needs_review) : rooms),
    [needsReviewOnly, rooms],
  );

  const selectedStudentRecord = useMemo(() => {
    if (!selectedStudent) {
      return null;
    }

    return (
      studentsQuery.data?.students.find(
        (student) => student.admission_number === selectedStudent,
      ) ?? null
    );
  }, [selectedStudent, studentsQuery.data?.students]);

  useEffect(() => {
    if (!selectedStudent || studentsQuery.isLoading || !studentsQuery.data) {
      return;
    }

    const exists = studentsQuery.data.students.some(
      (student) => student.admission_number === selectedStudent,
    );
    if (exists) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.delete("student");
    setSearchParams(next, { replace: true });
  }, [
    searchParams,
    selectedStudent,
    setSearchParams,
    studentsQuery.data,
    studentsQuery.isLoading,
  ]);

  const actions = (
    <Button
      disabled={
        exportMutation.isPending ||
        !runId ||
        !selectedSegment ||
        filteredRooms.length === 0
      }
      size="sm"
      variant="outline"
      onClick={() => {
        if (!runId || !selectedSegment) {
          return;
        }

        void exportMutation
          .mutateAsync({ runId, segmentKey: selectedSegment })
          .then((result) => {
            const downloadUrl = URL.createObjectURL(result.blob);
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = result.fileName;
            link.click();
            URL.revokeObjectURL(downloadUrl);
          })
          .catch(() => {
            // The inline alert surfaces export failures.
          });
      }}
    >
      {exportMutation.isPending ? "Exporting..." : "Export CSV"}
    </Button>
  );

  if (!runId) {
    return (
      <section className="space-y-4">
        <InlineAlert
          title="No run selected"
          message="Open matching runs to choose a run before viewing room results."
          tone="error"
        />
        <Button asChild size="sm" variant="accent">
          <Link to={`/app/${workspaceId}/matching-runs`}>Go to Matching Runs</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <AdminPageHeader
        title="Room Results"
        description={`Room-level matching output for run ${runId}.`}
        actions={actions}
      />

      {roomsQuery.data?.has_generated_profiles && (
        <DataWarningBanner hasGeneratedProfiles={true} context="results" />
      )}

      {segmentsQuery.isLoading ? (
        <InlineAlert
          title="Loading segments"
          message="Preparing segment filters for this run."
          tone="info"
        />
      ) : null}

      {segmentsQuery.isError ? (
        <InlineAlert
          title="Unable to load segments"
          message={
            segmentsQuery.error instanceof Error
              ? segmentsQuery.error.message
              : "Segment filter data is unavailable."
          }
          actions={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void segmentsQuery.refetch()}
            >
              Retry
            </Button>
          }
          tone="error"
        />
      ) : null}

      {selectedSegment && segmentsQuery.data ? (
        <RoomResultsFilters
          needsReviewOnly={needsReviewOnly}
          selectedSegment={selectedSegment}
          segments={segmentsQuery.data.segments}
          onNeedsReviewChange={(enabled) => {
            const next = new URLSearchParams(searchParams);
            next.set("needsReview", enabled ? "1" : "0");
            setSearchParams(next);
          }}
          onSegmentChange={(segmentKey) => {
            const next = new URLSearchParams(searchParams);
            next.set("segment", segmentKey);
            next.delete("student");
            setSelectedRoomId(null);
            setSearchParams(next);
          }}
        />
      ) : null}

      {roomsQuery.isLoading ? (
        <InlineAlert
          title="Loading room results"
          message="Fetching room assignments for the selected segment."
          tone="info"
        />
      ) : null}

      {roomsQuery.isError ? (
        <InlineAlert
          title="Unable to load room results"
          message={
            roomsQuery.error instanceof Error
              ? roomsQuery.error.message
              : "Room results request failed."
          }
          actions={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void roomsQuery.refetch()}
            >
              Retry
            </Button>
          }
          tone="error"
        />
      ) : null}

      {exportMutation.isError ? (
        <InlineAlert
          title="CSV export failed"
          message={
            exportMutation.error instanceof Error
              ? exportMutation.error.message
              : "Could not export assignment CSV."
          }
          tone="error"
        />
      ) : null}

      {selectedStudent && studentsQuery.isLoading ? (
        <InlineAlert
          title="Loading student details"
          message="Fetching selected student details for the side panel."
          tone="info"
        />
      ) : null}

      {selectedStudent && studentsQuery.isError ? (
        <InlineAlert
          title="Unable to load student details"
          message={
            studentsQuery.error instanceof Error
              ? studentsQuery.error.message
              : "Student details request failed."
          }
          actions={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void studentsQuery.refetch()}
            >
              Retry
            </Button>
          }
          tone="error"
        />
      ) : null}

      <Card className="border-border/80 bg-white/90">
        <CardContent className="space-y-3 pt-6">
          <p className="text-sm text-muted-foreground">
            Showing {filteredRooms.length} room
            {filteredRooms.length === 1 ? "" : "s"}.
          </p>

          <RoomResultsTable
            rows={filteredRooms}
            selectedRoomId={selectedRoomId}
            onRoomSelect={setSelectedRoomId}
            onStudentSelect={(admissionNumber) => {
              const next = new URLSearchParams(searchParams);
              next.set("student", admissionNumber);
              setSearchParams(next);
            }}
          />
        </CardContent>
      </Card>

      <DetailSidePanelShell
        description="Loaded from the run student results endpoint."
        open={Boolean(selectedStudentRecord)}
        title={selectedStudentRecord?.full_name ?? "Student details"}
        onClose={() => {
          const next = new URLSearchParams(searchParams);
          next.delete("student");
          setSearchParams(next);
        }}
      >
        {selectedStudentRecord ? (
          <RoomStudentDetailPanel
            roomId={selectedRoomId}
            student={selectedStudentRecord}
          />
        ) : null}
      </DetailSidePanelShell>
    </section>
  );
}
