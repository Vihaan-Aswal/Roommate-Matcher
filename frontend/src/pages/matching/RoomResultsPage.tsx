import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { AdminPageHeader } from "../../components/AdminPageHeader";
import { InlineAlert } from "../../components/InlineAlert";
import { RoomResultsFilters } from "../../components/matching/filters/RoomResultsFilters";
import { RoomResultsTable } from "../../components/matching/tables/RoomResultsTable";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { useAdminSegmentsQuery } from "../../hooks/useAdminSegments";
import { useAssignmentsExportMutation } from "../../hooks/useAssignmentsExportMutation";
import { useRunRoomsQuery } from "../../hooks/useRunRoomsQuery";

export function RoomResultsPage(): JSX.Element {
  const { runId } = useParams<{ runId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const segmentsQuery = useAdminSegmentsQuery();
  const exportMutation = useAssignmentsExportMutation();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const selectedSegment = searchParams.get("segment");
  const needsReviewOnly = searchParams.get("needsReview") === "1";

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

  const roomsQuery = useRunRoomsQuery(runId ?? "", selectedSegment);

  const rooms = roomsQuery.data?.rooms ?? [];
  const filteredRooms = useMemo(
    () =>
      needsReviewOnly
        ? rooms.filter((room) => room.needs_review)
        : rooms,
    [needsReviewOnly, rooms],
  );

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
          <Link to="/admin/matching-runs">Go to Matching Runs</Link>
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
    </section>
  );
}
