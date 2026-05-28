import { useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { AdminPageHeader } from "../../components/AdminPageHeader";
import { InlineAlert } from "../../components/InlineAlert";
import { StudentResultsFilters } from "../../components/matching/filters/StudentResultsFilters";
import { StudentResultsTable } from "../../components/matching/tables/StudentResultsTable";
import { DetailSidePanelShell } from "../../components/panels/DetailSidePanelShell";
import { StudentDetailPanel } from "../../components/panels/StudentDetailPanel";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { useAdminSegmentsQuery } from "../../hooks/useAdminSegments";
import { useRunStudentsAcrossSegmentsQuery } from "../../hooks/useRunStudentsAcrossSegmentsQuery";
import { useRunStudentsQuery } from "../../hooks/useRunStudentsQuery";
import { SATISFACTION_LABELS } from "../../lib/resultEnums";

const VALID_AT_RISK = new Set(["0", "1"]);
const VALID_LABELS = new Set<string>(["all", ...SATISFACTION_LABELS]);
import { useWorkspace } from "../../providers/WorkspaceProvider";

export function StudentResultsPage(): JSX.Element {
  const { workspaceId } = useWorkspace();

  const { runId } = useParams<{ runId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const segmentsQuery = useAdminSegmentsQuery();

  const selectedSegment = searchParams.get("segment") ?? "all";
  const selectedLabel = searchParams.get("label") ?? "all";
  const atRiskFlag = searchParams.get("atRisk") ?? "0";
  const selectedStudentId = searchParams.get("student");

  const segmentKeys = useMemo(
    () =>
      (segmentsQuery.data?.segments ?? []).map(
        (segment) => segment.segment_key,
      ),
    [segmentsQuery.data?.segments],
  );

  const singleSegmentQuery = useRunStudentsQuery(
    workspaceId,
    runId ?? "",
    selectedSegment === "all" ? null : selectedSegment,
  );

  const allSegmentsQuery = useRunStudentsAcrossSegmentsQuery(
    workspaceId,
    runId ?? "",
    segmentKeys,
    selectedSegment === "all" && Boolean(runId),
  );

  useEffect(() => {
    if (!runId) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    let changed = false;

    if (!next.has("segment")) {
      next.set("segment", "all");
      changed = true;
    } else if (
      selectedSegment !== "all" &&
      segmentKeys.length > 0 &&
      !segmentKeys.includes(selectedSegment)
    ) {
      next.set("segment", "all");
      changed = true;
    }

    if (!VALID_LABELS.has(selectedLabel)) {
      next.set("label", "all");
      changed = true;
    }

    if (!VALID_AT_RISK.has(atRiskFlag)) {
      next.set("atRisk", "0");
      changed = true;
    }

    if (changed) {
      setSearchParams(next, { replace: true });
    }
  }, [
    atRiskFlag,
    runId,
    searchParams,
    segmentKeys,
    selectedLabel,
    selectedSegment,
    setSearchParams,
  ]);

  const sourceStudents = useMemo(() => {
    if (selectedSegment === "all") {
      return allSegmentsQuery.students;
    }
    return singleSegmentQuery.data?.students ?? [];
  }, [
    allSegmentsQuery.students,
    selectedSegment,
    singleSegmentQuery.data?.students,
  ]);

  const isLoading =
    selectedSegment === "all"
      ? allSegmentsQuery.isLoading
      : singleSegmentQuery.isLoading;
  const isError =
    selectedSegment === "all"
      ? allSegmentsQuery.isError
      : singleSegmentQuery.isError;
  const queryError =
    selectedSegment === "all"
      ? allSegmentsQuery.error
      : singleSegmentQuery.error;

  const retryStudents = () => {
    if (selectedSegment === "all") {
      void allSegmentsQuery.refetchAll();
      return;
    }
    void singleSegmentQuery.refetch();
  };

  const atRiskOnly = atRiskFlag === "1";
  const filteredStudents = useMemo(
    () =>
      sourceStudents
        .filter((student) => {
          if (
            selectedLabel !== "all" &&
            student.satisfaction_label !== selectedLabel
          ) {
            return false;
          }
          if (atRiskOnly && !student.is_at_risk) {
            return false;
          }
          return true;
        })
        .sort((left, right) =>
          left.admission_number.localeCompare(right.admission_number),
        ),
    [atRiskOnly, selectedLabel, sourceStudents],
  );

  const selectedStudentRecord = filteredStudents.find(
    (student) => student.admission_number === selectedStudentId,
  );

  useEffect(() => {
    if (!selectedStudentId || isLoading) {
      return;
    }

    const exists = filteredStudents.some(
      (student) => student.admission_number === selectedStudentId,
    );
    if (exists) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.delete("student");
    setSearchParams(next, { replace: true });
  }, [
    filteredStudents,
    isLoading,
    searchParams,
    selectedStudentId,
    setSearchParams,
  ]);

  if (!runId) {
    return (
      <section className="space-y-4">
        <InlineAlert
          title="No run selected"
          message="Open matching runs to select a run before viewing student results."
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
        title="Student Results"
        description={`Student-level matching results for run ${runId}.`}
      />

      <StudentResultsFilters
        atRiskOnly={atRiskOnly}
        selectedLabel={
          VALID_LABELS.has(selectedLabel)
            ? (selectedLabel as "all" | "Excellent" | "Good" | "Okay" | "Poor")
            : "all"
        }
        selectedSegment={selectedSegment}
        segments={segmentsQuery.data?.segments ?? []}
        onAtRiskChange={(enabled) => {
          const next = new URLSearchParams(searchParams);
          next.set("atRisk", enabled ? "1" : "0");
          next.delete("student");
          setSearchParams(next);
        }}
        onLabelChange={(label) => {
          const next = new URLSearchParams(searchParams);
          next.set("label", label);
          next.delete("student");
          setSearchParams(next);
        }}
        onSegmentChange={(segment) => {
          const next = new URLSearchParams(searchParams);
          next.set("segment", segment);
          next.delete("student");
          setSearchParams(next);
        }}
      />

      {isLoading ? (
        <InlineAlert
          title="Loading student results"
          message="Fetching student records for the active filters."
          tone="info"
        />
      ) : null}

      {isError ? (
        <InlineAlert
          title="Unable to load student results"
          message={
            queryError instanceof Error
              ? queryError.message
              : "Student results request failed."
          }
          actions={
            <Button size="sm" variant="outline" onClick={retryStudents}>
              Retry
            </Button>
          }
          tone="error"
        />
      ) : null}

      {!isLoading && !isError && sourceStudents.length === 0 ? (
        <InlineAlert
          title="No student data"
          message="This run does not have student artifacts for the selected segment."
          tone="info"
        />
      ) : null}

      {!isLoading &&
      !isError &&
      sourceStudents.length > 0 &&
      filteredStudents.length === 0 ? (
        <InlineAlert
          title="No rows match current filters"
          message="Clear label and at-risk filters to view all students."
          tone="info"
        />
      ) : null}

      <Card className="border-border/80 bg-white/90">
        <CardContent className="space-y-3 pt-6">
          <p className="text-sm text-muted-foreground">
            Showing {filteredStudents.length} student
            {filteredStudents.length === 1 ? "" : "s"}.
          </p>
          <StudentResultsTable
            rows={filteredStudents}
            selectedStudentId={selectedStudentId}
            onStudentSelect={(admissionNumber) => {
              const next = new URLSearchParams(searchParams);
              next.set("student", admissionNumber);
              setSearchParams(next);
            }}
          />
        </CardContent>
      </Card>

      <DetailSidePanelShell
        description={`Filters: segment=${selectedSegment}, label=${selectedLabel}, atRisk=${atRiskFlag}`}
        open={Boolean(selectedStudentRecord)}
        title={selectedStudentRecord?.full_name ?? "Student details"}
        onClose={() => {
          const next = new URLSearchParams(searchParams);
          next.delete("student");
          setSearchParams(next);
        }}
      >
        {selectedStudentRecord ? (
          <StudentDetailPanel student={selectedStudentRecord} />
        ) : null}
      </DetailSidePanelShell>
    </section>
  );
}
