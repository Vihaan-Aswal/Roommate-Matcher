import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";

import { AdminPageHeader } from "../../components/AdminPageHeader";
import DataWarningBanner from "../../components/DataWarningBanner";
import { InlineAlert } from "../../components/InlineAlert";
import { RoomResultsFilters } from "../../components/matching/filters/RoomResultsFilters";
import { RoomResultsTable } from "../../components/matching/tables/RoomResultsTable";
import { DetailSidePanelShell } from "../../components/panels/DetailSidePanelShell";
import { RoomStudentDetailPanel } from "../../components/panels/RoomStudentDetailPanel";
import { Button } from "../../components/ui/button";
import { useAdminSegmentsQuery } from "../../hooks/useAdminSegments";
import { useAssignmentsExportMutation } from "../../hooks/useAssignmentsExportMutation";
import { useRunRoomsQuery } from "../../hooks/useRunRoomsQuery";
import { useRunStudentsQuery } from "../../hooks/useRunStudentsQuery";
import { segmentLabel } from "../../lib/segmentLabel";
import { useWorkspace } from "../../providers/WorkspaceProvider";

export function RoomResultsPage(): JSX.Element {
  const { workspaceId, runId } = useParams<{ workspaceId: string; runId: string }>();
  if (!workspaceId) throw new Error("workspaceId is required");
  const { workspaceName } = useWorkspace();
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
  }, [searchParams, segmentsQuery.data?.segments, selectedSegment, setSearchParams]);

  const roomsQuery = useRunRoomsQuery(workspaceId, runId ?? "", selectedSegment ?? "");
  const studentsQuery = useRunStudentsQuery(workspaceId, runId ?? "", selectedSegment ?? "");

  const selectedSegmentRow = (segmentsQuery.data?.segments ?? []).find(
    (segment) => segment.segment_key === selectedSegment,
  ) ?? { segment_key: selectedSegment ?? "" };

  const rooms = roomsQuery.data?.rooms ?? [];
  const filteredRooms = useMemo(
    () => (needsReviewOnly ? rooms.filter((room) => room.needs_review) : rooms),
    [needsReviewOnly, rooms],
  );
  const reviewCount = rooms.filter((room) => room.needs_review).length;

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
  }, [searchParams, selectedStudent, setSearchParams, studentsQuery.data, studentsQuery.isLoading]);

  if (!runId) {
    return (
      <section className="desk-stack">
        <InlineAlert
          title="No run selected"
          message="Open matching runs to choose a run before viewing room results."
          tone="error"
        />
        <div>
          <Button asChild size="sm">
            <Link to={`/app/${workspaceId}/matching-runs`}>Go to matching runs</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="desk-stack">
      <AdminPageHeader
        title="Room Results"
        workspace={workspaceName ?? undefined}
        meta={
          selectedSegment ? (
            <span className="desk-mono">{segmentLabel(selectedSegmentRow)}</span>
          ) : undefined
        }
        description={`Room-level matching output for run ${runId}.`}
        actions={
          <Button
            disabled={
              exportMutation.isPending || !runId || !selectedSegment || filteredRooms.length === 0
            }
            size="sm"
            variant="outline"
            onClick={() => {
              if (!runId || !selectedSegment) return;
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
                  // Surfaced by the inline alert below.
                });
            }}
          >
            <Download size={13} strokeWidth={1.8} aria-hidden="true" />
            {exportMutation.isPending ? "Exporting…" : "Export CSV"}
          </Button>
        }
      />

      {roomsQuery.data?.has_generated_profiles ? (
        <DataWarningBanner hasGeneratedProfiles={true} context="results" />
      ) : null}

      {segmentsQuery.isError ? (
        <InlineAlert
          title="Segments are unavailable"
          message={
            segmentsQuery.error instanceof Error
              ? segmentsQuery.error.message
              : "Segment filter data is unavailable."
          }
          tone="error"
          actions={
            <Button size="sm" variant="outline" onClick={() => void segmentsQuery.refetch()}>
              Try again
            </Button>
          }
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

      {roomsQuery.isError ? (
        <InlineAlert
          title="Room results could not be read"
          message={
            roomsQuery.error instanceof Error
              ? roomsQuery.error.message
              : "Room results request failed."
          }
          tone="error"
          actions={
            <Button size="sm" variant="outline" onClick={() => void roomsQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : null}

      {exportMutation.isError ? (
        <InlineAlert
          title="The CSV was not exported"
          message={
            exportMutation.error instanceof Error
              ? exportMutation.error.message
              : "Could not export the assignment CSV."
          }
          tone="error"
        />
      ) : null}

      {studentsQuery.isError ? (
        <InlineAlert
          title="Student details are unavailable"
          message={
            studentsQuery.error instanceof Error
              ? studentsQuery.error.message
              : "Student details request failed."
          }
          tone="error"
          actions={
            <Button size="sm" variant="outline" onClick={() => void studentsQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : null}

      <section className="desk-stack-sm" aria-labelledby="room-register-heading">
        <div className="desk-section-head">
          <h2 className="desk-section-title" id="room-register-heading">
            The register
          </h2>
          <p className="desk-section-note">
            {filteredRooms.length} room{filteredRooms.length === 1 ? "" : "s"}
            {reviewCount > 0 ? ` · ${reviewCount} need review` : " · none need review"}
          </p>
        </div>

        {roomsQuery.isLoading ? (
          <div className="desk-stack-sm" aria-busy="true">
            <p className="desk-loading-note">Reading rooms</p>
            <div className="desk-skel" style={{ height: 64 }} />
            <div className="desk-skel" style={{ height: 64 }} />
            <div className="desk-skel" style={{ height: 64 }} />
          </div>
        ) : (
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
        )}
      </section>

      <DetailSidePanelShell
        description={selectedSegment ? segmentLabel(selectedSegmentRow) : undefined}
        open={Boolean(selectedStudentRecord)}
        title={selectedStudentRecord?.full_name ?? "Student details"}
        onClose={() => {
          const next = new URLSearchParams(searchParams);
          next.delete("student");
          setSearchParams(next);
        }}
      >
        {selectedStudentRecord ? (
          <RoomStudentDetailPanel roomId={selectedRoomId} student={selectedStudentRecord} />
        ) : null}
      </DetailSidePanelShell>
    </section>
  );
}
