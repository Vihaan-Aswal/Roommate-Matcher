import { Link } from "react-router-dom";

import { AdminPageHeader } from "../components/AdminPageHeader";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { InlineAlert } from "../components/InlineAlert";
import { StatCard } from "../components/StatCard";
import {
  useAdminFormStatusQuery,
  useAdminNonSubmittersQuery,
} from "../hooks/useAdminFormCollection";
import { QUESTION_CONFIGS } from "../lib/formQuestions";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

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
  const formStatusQuery = useAdminFormStatusQuery();
  const nonSubmittersQuery = useAdminNonSubmittersQuery();

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
      <Button asChild size="sm" variant="outline">
        <a href="/form" rel="noreferrer" target="_blank">
          Open Student Form
        </a>
      </Button>
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
            formStatusQuery.data ? `${formStatusQuery.data.percentage_valid}%` : "-"
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
            disabled={!nonSubmittersQuery.data || nonSubmittersQuery.data.total_count === 0}
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
          <CardTitle className="text-lg">Questionnaire Preview (read-only)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {QUESTION_CONFIGS.map((question) => (
            <article
              key={question.id}
              className="rounded-lg border border-border/70 bg-background/70 p-4"
            >
              <h3 className="text-sm font-semibold text-foreground">{question.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{question.prompt}</p>
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
