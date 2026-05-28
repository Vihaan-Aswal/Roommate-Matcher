import { Link } from "react-router-dom";
import { useState } from "react";

import { AdminPageHeader } from "../components/AdminPageHeader";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { InlineAlert } from "../components/InlineAlert";
import { StatCard } from "../components/StatCard";
import {
  useAdminFormStatusQuery,
  useAdminNonSubmittersQuery,
  useWorkspaceFormLinkQuery,
  useRegenerateFormLinkMutation,
} from "../hooks/useAdminFormCollection";
import { QUESTION_CONFIGS } from "../lib/formQuestions";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { useWorkspace } from "../providers/WorkspaceProvider";
import { Copy, RefreshCw, Check } from "lucide-react";

function triggerCsvDownload(fileName: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminFormCollection(): JSX.Element {
  const { workspaceId } = useWorkspace();
  const formStatusQuery = useAdminFormStatusQuery(workspaceId);
  const nonSubmittersQuery = useAdminNonSubmittersQuery(workspaceId);
  const formLinkQuery = useWorkspaceFormLinkQuery(workspaceId);
  const regenerateMutation = useRegenerateFormLinkMutation(workspaceId);

  const [copied, setCopied] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  const handleCopy = () => {
    if (formLinkQuery.data?.form_url) {
      navigator.clipboard.writeText(formLinkQuery.data.form_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerate = () => {
    regenerateMutation.mutate(undefined, {
      onSuccess: () => setShowRegenerateConfirm(false),
    });
  };

  const segmentColumns: DataTableColumn<
    NonNullable<typeof formStatusQuery.data>["by_segment"][number]
  >[] = [
    {
      key: "segment_key",
      header: "Segment",
      cell: (row) => row.segment_key,
    },
    {
      key: "total",
      header: "Total",
      cell: (row) => row.total,
    },
    {
      key: "valid",
      header: "Valid",
      cell: (row) => row.valid,
    },
    {
      key: "percentage",
      header: "Completion %",
      cell: (row) => `${row.percentage}%`,
    },
  ];

  const nonSubmitterColumns: DataTableColumn<
    NonNullable<typeof nonSubmittersQuery.data>["non_submitters"][number]
  >[] = [
    {
      key: "admission_number",
      header: "Admission Number",
      cell: (row) => row.admission_number,
    },
    {
      key: "full_name",
      header: "Student",
      cell: (row) => row.full_name,
    },
    {
      key: "segment_key",
      header: "Segment",
      cell: (row) => row.segment_key,
    },
  ];

  const actions = (
    <>
      <Button asChild size="sm" variant="accent">
        <Link to="/admin/students-data">Go to Uploads</Link>
      </Button>
    </>
  );

  return (
    <section className="space-y-6">
      <AdminPageHeader
        title="Form & Collection"
        description="Monitor completion, review non-submitters, and keep the questionnaire visible for admin reference."
        actions={actions}
      />

      <Card className="border-border/80 bg-white/90">
        <CardHeader>
          <CardTitle className="text-lg">Public Form Link</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Share this link with your students to collect their preferences.
          </p>
        </CardHeader>
        <CardContent>
          {formLinkQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading form link...</p>
          ) : formLinkQuery.isError ? (
            <InlineAlert
              title="Unable to load form link"
              message={
                formLinkQuery.error instanceof Error
                  ? formLinkQuery.error.message
                  : "Request failed."
              }
              tone="error"
            />
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex-1 bg-muted px-4 py-2.5 rounded-lg border border-border/80 text-sm overflow-x-auto whitespace-nowrap text-foreground font-mono">
                {formLinkQuery.data?.form_url}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCopy} variant="outline" size="sm" className="gap-2">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy link"}
                </Button>
                {!showRegenerateConfirm ? (
                  <Button onClick={() => setShowRegenerateConfirm(true)} variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10">
                    <RefreshCw className="h-4 w-4" />
                    Regenerate link
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button onClick={handleRegenerate} variant="destructive" size="sm" disabled={regenerateMutation.isPending}>
                      {regenerateMutation.isPending ? "Regenerating..." : "Yes, Regenerate"}
                    </Button>
                    <Button onClick={() => setShowRegenerateConfirm(false)} variant="outline" size="sm" disabled={regenerateMutation.isPending}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
          {showRegenerateConfirm && (
            <p className="mt-3 text-sm text-destructive font-medium">
              Warning: Regenerating the link will immediately invalidate the current link. Any students attempting to use the old link will see an error.
            </p>
          )}
          <div className="mt-4 pt-4 border-t border-border/50">
             <Button asChild size="sm" variant="outline">
                <a href={formLinkQuery.data?.form_url || "#"} rel="noreferrer" target="_blank">
                  Open Student Form
                </a>
              </Button>
          </div>
        </CardContent>
      </Card>

      {formStatusQuery.isError ? (
        <InlineAlert
          title="Unable to load form collection stats"
          message={
            formStatusQuery.error instanceof Error
              ? formStatusQuery.error.message
              : "Form status request failed."
          }
          tone="error"
        />
      ) : null}

      {nonSubmittersQuery.isError ? (
        <InlineAlert
          title="Unable to load non-submitters"
          message={
            nonSubmittersQuery.error instanceof Error
              ? nonSubmittersQuery.error.message
              : "Non-submitter request failed."
          }
          tone="error"
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Students"
          value={formStatusQuery.data?.total_students ?? "-"}
        />
        <StatCard
          label="Valid Responses"
          value={formStatusQuery.data?.valid_responses ?? "-"}
        />
        <StatCard
          label="Invalid Responses"
          value={formStatusQuery.data?.invalid_responses ?? "-"}
        />
        <StatCard
          label="Completion"
          value={
            formStatusQuery.data
              ? `${formStatusQuery.data.percentage_valid}%`
              : "-"
          }
        />
      </div>

      <Card className="border-border/80 bg-white/90">
        <CardHeader>
          <CardTitle className="text-lg">Completion by Segment</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={segmentColumns}
            emptyText={
              formStatusQuery.isLoading
                ? "Loading segment completion..."
                : "No segment-level form data available."
            }
            getRowId={(row) => row.segment_key}
            rows={formStatusQuery.data?.by_segment ?? []}
          />
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-white/90">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">Non-Submitters</CardTitle>
          <Button
            disabled={
              !nonSubmittersQuery.data ||
              nonSubmittersQuery.data.total_count === 0
            }
            size="sm"
            variant="outline"
            onClick={() => {
              const rows = nonSubmittersQuery.data?.non_submitters ?? [];
              const csv = [
                "admission_number,full_name,segment_key",
                ...rows.map(
                  (row) =>
                    `${row.admission_number},${JSON.stringify(row.full_name)},${row.segment_key}`,
                ),
              ].join("\n");
              triggerCsvDownload("non_submitters.csv", csv);
            }}
          >
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={nonSubmitterColumns}
            emptyText={
              nonSubmittersQuery.isLoading
                ? "Loading non-submitters..."
                : "No pending non-submitters."
            }
            getRowId={(row) => row.admission_number}
            rows={nonSubmittersQuery.data?.non_submitters ?? []}
          />
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-white/90">
        <CardHeader>
          <CardTitle className="text-lg">
            Questionnaire Preview (read-only)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {QUESTION_CONFIGS.map((question) => (
            <article
              key={question.id}
              className="rounded-lg border border-border/70 bg-background/70 p-4"
            >
              <h3 className="text-sm font-semibold text-foreground">
                {question.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {question.prompt}
              </p>
              <ul className="mt-3 space-y-1 text-sm text-foreground">
                {question.options.map((option) => (
                  <li key={option.value}>- {option.label}</li>
                ))}
              </ul>
            </article>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
