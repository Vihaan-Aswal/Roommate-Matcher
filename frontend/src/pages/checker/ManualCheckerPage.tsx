import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { AdminPageHeader } from "../../components/AdminPageHeader";
import { InlineAlert } from "../../components/InlineAlert";
import { CheckerResultPanel } from "../../components/checker/CheckerResultPanel";
import { CheckerSelectionPanel } from "../../components/checker/CheckerSelectionPanel";
import { Button } from "../../components/ui/button";
import { useAdminSegmentsQuery } from "../../hooks/useAdminSegments";
import { useManualCheckerMutation } from "../../hooks/useManualCheckerMutation";
import { useSegmentStudentsQuery } from "../../hooks/useSegmentStudentsQuery";

function resolveValidationMessage(
  segmentKey: string,
  roomSize: number | null,
  selectedExistingIds: string[],
  selectedCandidateId: string | null,
): string {
  if (!segmentKey) {
    return "Select a segment.";
  }

  if (roomSize === null) {
    return "Room size is unavailable for the selected segment.";
  }

  if (selectedExistingIds.length !== roomSize - 1) {
    return `Select exactly ${roomSize - 1} existing students.`;
  }

  if (!selectedCandidateId) {
    return "Select one candidate student.";
  }

  const allIds = [...selectedExistingIds, selectedCandidateId];
  if (new Set(allIds).size !== allIds.length) {
    return "Duplicate student selections are not allowed.";
  }

  if (allIds.length !== roomSize) {
    return `Total selected students must equal room size ${roomSize}.`;
  }

  return "Ready to run compatibility report.";
}

export function ManualCheckerPage(): JSX.Element {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  if (!workspaceId) throw new Error("workspaceId is required");

  const [searchParams, setSearchParams] = useSearchParams();
  const segmentsQuery = useAdminSegmentsQuery(workspaceId);
  const checkerMutation = useManualCheckerMutation(workspaceId);

  const [existingStudentIds, setExistingStudentIds] = useState<string[]>([]);
  const [candidateStudentId, setCandidateStudentId] = useState<string | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");

  const segmentKey = searchParams.get("segment") ?? "";

  useEffect(() => {
    const segments = segmentsQuery.data?.segments ?? [];
    if (segments.length === 0) {
      return;
    }

    const isValid = segments.some(
      (segment) => segment.segment_key === segmentKey,
    );
    if (segmentKey && isValid) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.set("segment", segments[0].segment_key);
    setSearchParams(next, { replace: true });
  }, [searchParams, segmentKey, segmentsQuery.data?.segments, setSearchParams]);

  const segmentStudentsQuery = useSegmentStudentsQuery(segmentKey || null);

  const sortedStudents = useMemo(
    () =>
      [...(segmentStudentsQuery.data?.students ?? [])].sort((left, right) =>
        left.admission_number.localeCompare(right.admission_number),
      ),
    [segmentStudentsQuery.data?.students],
  );

  const roomSize = useMemo(() => {
    if (segmentStudentsQuery.data?.room_size) {
      return segmentStudentsQuery.data.room_size;
    }

    const segmentRow = (segmentsQuery.data?.segments ?? []).find(
      (segment) => segment.segment_key === segmentKey,
    );
    return segmentRow?.room_size ?? null;
  }, [
    segmentKey,
    segmentStudentsQuery.data?.room_size,
    segmentsQuery.data?.segments,
  ]);

  const validationMessage = resolveValidationMessage(
    segmentKey,
    roomSize,
    existingStudentIds,
    candidateStudentId,
  );
  const canRun = validationMessage === "Ready to run compatibility report.";

  const runChecker = () => {
    if (!canRun || roomSize === null || !candidateStudentId) {
      return;
    }

    const studentIds = [...existingStudentIds, candidateStudentId].sort(
      (left, right) => left.localeCompare(right),
    );

    void checkerMutation.mutateAsync({
      segment_key: segmentKey,
      room_size: roomSize,
      student_ids: studentIds,
    });
  };

  return (
    <section className="space-y-4">
      <AdminPageHeader
        title="Manual Checker"
        description="Advisory compatibility check for assembling an alternate room group without changing saved assignments."
      />

      {segmentsQuery.isLoading ? (
        <InlineAlert
          title="Loading segments"
          message="Preparing segment list for checker input."
          tone="info"
        />
      ) : null}

      {segmentsQuery.isError ? (
        <InlineAlert
          title="Unable to load segments"
          message={
            segmentsQuery.error instanceof Error
              ? segmentsQuery.error.message
              : "Segments request failed."
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

      {segmentStudentsQuery.isLoading ? (
        <InlineAlert
          title="Loading segment students"
          message="Fetching student roster and room size metadata for selected segment."
          tone="info"
        />
      ) : null}

      {segmentStudentsQuery.isError ? (
        <InlineAlert
          title="Unable to load segment students"
          message={
            segmentStudentsQuery.error instanceof Error
              ? segmentStudentsQuery.error.message
              : "Segment students request failed."
          }
          tone="error"
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <CheckerSelectionPanel
          canRun={canRun}
          isRunning={checkerMutation.isPending}
          roomSize={roomSize}
          searchTerm={searchTerm}
          selectedCandidateId={candidateStudentId}
          selectedExistingIds={existingStudentIds}
          selectedSegment={segmentKey}
          segments={segmentsQuery.data?.segments ?? []}
          students={sortedStudents}
          validationMessage={validationMessage}
          onCandidateChange={setCandidateStudentId}
          onRun={runChecker}
          onSearchTermChange={setSearchTerm}
          onSegmentChange={(nextSegment) => {
            const next = new URLSearchParams(searchParams);
            next.set("segment", nextSegment);
            setSearchParams(next);
            setExistingStudentIds([]);
            setCandidateStudentId(null);
            setSearchTerm("");
          }}
          onToggleExisting={(admissionNumber) => {
            setExistingStudentIds((previous) => {
              if (previous.includes(admissionNumber)) {
                return previous.filter((id) => id !== admissionNumber);
              }
              return [...previous, admissionNumber].sort((left, right) =>
                left.localeCompare(right),
              );
            });

            if (candidateStudentId === admissionNumber) {
              setCandidateStudentId(null);
            }
          }}
        />

        <CheckerResultPanel
          errorMessage={
            checkerMutation.error instanceof Error
              ? checkerMutation.error.message
              : null
          }
          isRunning={checkerMutation.isPending}
          result={checkerMutation.data ?? null}
        />
      </div>
    </section>
  );
}
