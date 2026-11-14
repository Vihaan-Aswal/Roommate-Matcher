import { useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { AdminPageHeader } from "../../components/AdminPageHeader";
import DataWarningBanner from "../../components/DataWarningBanner";
import { InlineAlert } from "../../components/InlineAlert";
import { EmptyState } from "../../components/EmptyState";
import { StudentResultsFilters } from "../../components/matching/filters/StudentResultsFilters";
import { StudentResultsTable } from "../../components/matching/tables/StudentResultsTable";
import { DetailSidePanelShell } from "../../components/panels/DetailSidePanelShell";
import { StudentDetailPanel } from "../../components/panels/StudentDetailPanel";
import { Button } from "../../components/ui/button";
import { useAdminSegmentsQuery } from "../../hooks/useAdminSegments";
import { useRunStudentsAllSegmentsQuery } from "../../hooks/useRunStudentsAllSegmentsQuery";
import { useRunStudentsQuery } from "../../hooks/useRunStudentsQuery";
import { SATISFACTION_LABELS } from "../../lib/resultEnums";
import { useWorkspace } from "../../providers/WorkspaceProvider";

const VALID_AT_RISK = new Set(["0", "1"]);
const VALID_LABELS = new Set<string>(["all", ...SATISFACTION_LABELS]);

const BAR_TONES: Record<string, string> = {
  Excellent: "var(--paper-ink)",
  Good: "rgba(29,37,25,0.62)",
  Okay: "rgba(29,37,25,0.32)",
  Poor: "var(--amber)",
};

export function StudentResultsPage(): JSX.Element {
  const { workspaceId, runId } = useParams<{ workspaceId: string; runId: string }>();
  if (!workspaceId) throw new Error("workspaceId is required");
  const { workspaceName } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const segmentsQuery = useAdminSegmentsQuery(workspaceId);

  const selectedSegment = searchParams.get("segment") ?? "all";
  const selectedLabel = searchParams.get("label") ?? "all";
  const atRiskFlag = searchParams.get("atRisk") ?? "0";
  const selectedStudentId = searchParams.get("student");
  const atRiskMode = atRiskFlag === "1";

  const segmentKeys = useMemo(
    () => (segmentsQuery.data?.segments ?? []).map((segment) => segment.segment_key),
    [segmentsQuery.data?.segments],
  );

  const singleSegmentQuery = useRunStudentsQuery(
    workspaceId,
    runId ?? "",
    selectedSegment === "all" ? null : selectedSegment,
  );

  const allSegmentsQuery = useRunStudentsAllSegmentsQuery(
    workspaceId,
    runId ?? "",
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
  }, [allSegmentsQuery.students, selectedSegment, singleSegmentQuery.data?.students]);

  const isLoading =
    selectedSegment === "all" ? allSegmentsQuery.isLoading : singleSegmentQuery.isLoading;
  const isError =
    selectedSegment === "all" ? allSegmentsQuery.isError : singleSegmentQuery.isError;
  const queryError =
    selectedSegment === "all" ? allSegmentsQuery.error : singleSegmentQuery.error;

  const retryStudents = () => {
    if (selectedSegment === "all") {
      void allSegmentsQuery.refetchAll();
      return;
    }
    void singleSegmentQuery.refetch();
  };

  const atRiskOnly = atRiskFlag === "1";

  /** Distribution of the whole segment, before the label filter narrows the table. */
  const distribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const student of sourceStudents) {
      const label = student.satisfaction_label;
      counts[label] = (counts[label] ?? 0) + 1;
    }
    return counts;
  }, [sourceStudents]);

  const totalInSource = sourceStudents.length;
  const atRiskCount = useMemo(
    () => sourceStudents.filter((student) => student.is_at_risk).length,
    [sourceStudents],
  );

  const filteredStudents = useMemo(
    () =>
      sourceStudents
        .filter((student) => {
          if (selectedLabel !== "all" && student.satisfaction_label !== selectedLabel) {
            return false;
          }
          if (atRiskOnly && !student.is_at_risk) {
            return false;
          }
          return true;
        })
        .sort((left, right) => left.admission_number.localeCompare(right.admission_number)),
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
  }, [filteredStudents, isLoading, searchParams, selectedStudentId, setSearchParams]);

  if (!runId) {
    return (
      <section className="desk-stack">
        <InlineAlert
          title="No run selected"
          message="Open matching runs to select a run before viewing student results."
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
        title={atRiskMode ? "At-Risk Review" : "Student Results"}
        workspace={workspaceName ?? undefined}
        meta={
          <>
            <span className="desk-mono">{runId}</span>
            <span className="desk-sep">·</span>
            {selectedSegment === "all" ? "all segments" : selectedSegment}
            <span className="desk-sep">·</span>
            {atRiskCount} at risk
          </>
        }
        description={`Student-level matching results for run ${runId}.`}
      />

      {atRiskMode ? (
        <div className="desk-note" data-tone="attention">
          <div>
            <p className="desk-note-title">Reviewing the students below the floor</p>
            <p className="desk-note-body">
              These students scored under 0.55. Read the reasons, then decide whether the pairing
              needs a second look before keys are issued. Nothing here changes an assignment.
            </p>
          </div>
        </div>
      ) : null}

      {singleSegmentQuery.data?.has_generated_profiles ? (
        <DataWarningBanner hasGeneratedProfiles={true} context="results" />
      ) : null}

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

      {isError ? (
        <InlineAlert
          title="Student results could not be read"
          message={
            queryError instanceof Error ? queryError.message : "Student results request failed."
          }
          tone="error"
          actions={
            <Button size="sm" variant="outline" onClick={retryStudents}>
              Try again
            </Button>
          }
        />
      ) : null}

      {isLoading ? (
        <div className="desk-stack-sm" aria-busy="true">
          <p className="desk-loading-note">Reading students</p>
          <div className="desk-skel" style={{ height: 40 }} />
          <div className="desk-skel" style={{ height: 40 }} />
          <div className="desk-skel" style={{ height: 40 }} />
        </div>
      ) : null}

      {!isLoading && !isError && totalInSource > 0 ? (
        <div className="desk-stack-sm" style={{ gap: 8 }}>
          <div className="desk-row-between">
            <p className="desk-overline">Distribution in this view</p>
            <p className="desk-section-note">{totalInSource} students</p>
          </div>
          <div
            className="desk-stackbar"
            role="img"
            aria-label={SATISFACTION_LABELS.map(
              (label) => `${label} ${distribution[label] ?? 0}`,
            ).join(", ")}
          >
            {SATISFACTION_LABELS.map((label) => {
              const count = distribution[label] ?? 0;
              if (count === 0) return null;
              return (
                <span
                  key={label}
                  style={{
                    width: `${(count / totalInSource) * 100}%`,
                    background: BAR_TONES[label],
                  }}
                />
              );
            })}
          </div>
          <div className="desk-stackbar-legend">
            {SATISFACTION_LABELS.map((label) => (
              <span key={label}>
                {label} <b>{distribution[label] ?? 0}</b>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {!isLoading && !isError && totalInSource === 0 ? (
        <EmptyState
          title="This run has no students for this segment"
          line="Pick another segment, or check that the run completed after the roster was uploaded."
        />
      ) : null}

      {!isLoading && !isError && totalInSource > 0 && filteredStudents.length === 0 ? (
        <EmptyState
          tone={atRiskMode ? "good" : undefined}
          title={atRiskMode ? "No student is below the floor" : "No students match these filters"}
          line={
            atRiskMode
              ? "Every student in this view scored 0.55 or above. Widen the segment filter to check the rest of the cohort."
              : "Clear the label or at-risk filter to see the rest of the segment."
          }
        />
      ) : null}

      {!isLoading && !isError && filteredStudents.length > 0 ? (
        <section className="desk-stack-sm" aria-labelledby="student-register-heading">
          <div className="desk-section-head">
            <h2 className="desk-section-title" id="student-register-heading">
              The register
            </h2>
            <p className="desk-section-note">
              {filteredStudents.length} student{filteredStudents.length === 1 ? "" : "s"}
            </p>
          </div>
          <StudentResultsTable
            rows={filteredStudents}
            selectedStudentId={selectedStudentId}
            onStudentSelect={(admissionNumber) => {
              const next = new URLSearchParams(searchParams);
              next.set("student", admissionNumber);
              setSearchParams(next);
            }}
          />
        </section>
      ) : null}

      <DetailSidePanelShell
        description={
          selectedStudentRecord
            ? `Room ${selectedStudentRecord.room_id} · ${selectedStudentRecord.roommate_ids.length} roommate${
                selectedStudentRecord.roommate_ids.length === 1 ? "" : "s"
              }`
            : undefined
        }
        open={Boolean(selectedStudentRecord)}
        title={selectedStudentRecord?.full_name ?? "Student details"}
        onClose={() => {
          const next = new URLSearchParams(searchParams);
          next.delete("student");
          setSearchParams(next);
        }}
      >
        {selectedStudentRecord ? <StudentDetailPanel student={selectedStudentRecord} /> : null}
      </DetailSidePanelShell>
    </section>
  );
}
