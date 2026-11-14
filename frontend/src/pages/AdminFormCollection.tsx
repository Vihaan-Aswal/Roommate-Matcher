import { Link } from "react-router-dom";
import { useState } from "react";
import { Check, Copy, ExternalLink, RefreshCw } from "lucide-react";

import { AdminPageHeader } from "../components/AdminPageHeader";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { InlineAlert } from "../components/InlineAlert";
import { EmptyState } from "../components/EmptyState";
import {
  useAdminFormStatusQuery,
  useAdminNonSubmittersQuery,
  useWorkspaceFormLinkQuery,
  useRegenerateFormLinkMutation,
} from "../hooks/useAdminFormCollection";
import { QUESTION_CONFIGS } from "../lib/formQuestions";
import { Button } from "../components/ui/button";
import { useWorkspace } from "../providers/WorkspaceProvider";

function triggerCsvDownload(fileName: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatExpiry(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return parsed.toLocaleDateString(undefined, { dateStyle: "medium" });
}


export function AdminFormCollection(): JSX.Element {
  const { workspaceId, workspaceName } = useWorkspace();
  const formStatusQuery = useAdminFormStatusQuery(workspaceId);
  const nonSubmittersQuery = useAdminNonSubmittersQuery(workspaceId);
  const formLinkQuery = useWorkspaceFormLinkQuery(workspaceId);
  const regenerateMutation = useRegenerateFormLinkMutation(workspaceId);

  const [copied, setCopied] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  // The API issues a token, not a URL: compose the public link from the current origin.
  const formUrl = formLinkQuery.data?.form_url
    ? formLinkQuery.data.form_url
    : formLinkQuery.data?.token
      ? `${window.location.origin}/f/${formLinkQuery.data.token}`
      : null;

  const handleCopy = () => {
    if (formUrl) {
      navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerate = () => {
    regenerateMutation.mutate(undefined, {
      onSuccess: () => setShowRegenerateConfirm(false),
    });
  };

  const status = formStatusQuery.data;
  const total = status?.total_students ?? 0;
  const valid = status?.valid_responses ?? 0;
  const percentage = status?.percentage_valid ?? 0;
  const pendingCount = Math.max(0, total - valid);

  const segmentColumns: DataTableColumn<
    NonNullable<typeof formStatusQuery.data>["by_segment"][number]
  >[] = [
    {
      key: "segment_key",
      header: "Segment",
      cell: (row) => <span className="desk-mono">{row.segment_key}</span>,
    },
    {
      key: "total",
      header: "Students",
      align: "right",
      cell: (row) => <span className="desk-num">{row.total}</span>,
    },
    {
      key: "valid",
      header: "Answered",
      align: "right",
      cell: (row) => <span className="desk-num">{row.valid}</span>,
    },
    {
      key: "percentage",
      header: "Completion",
      cell: (row) => (
        <div className="desk-row" style={{ gap: 8 }}>
          <span className="desk-meter" style={{ width: 90 }}>
            <span style={{ width: `${Math.min(100, Math.max(0, row.percentage))}%` }} />
          </span>
          <span className="desk-num" style={{ color: "var(--paper-mid)" }}>
            {row.percentage}%
          </span>
        </div>
      ),
    },
  ];

  const nonSubmitterColumns: DataTableColumn<
    NonNullable<typeof nonSubmittersQuery.data>["non_submitters"][number]
  >[] = [
    {
      key: "admission_number",
      header: "Admission",
      cell: (row) => <span className="desk-mono">{row.admission_number}</span>,
    },
    {
      key: "full_name",
      header: "Student",
      cell: (row) => row.full_name,
    },
    {
      key: "segment_key",
      header: "Segment",
      cell: (row) => <span className="desk-mono">{row.segment_key}</span>,
    },
  ];

  const expiry = formatExpiry(formLinkQuery.data?.expires_at);

  return (
    <section className="desk-stack">
      <AdminPageHeader
        title="Form & Collection"
        workspace={workspaceName ?? undefined}
        meta={<>{total} students</>}
        description="One link per workspace. Students verify themselves against the roster, answer twelve questions once, and only their latest valid response is counted."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to={`/app/${workspaceId}/students-data`}>Go to uploads</Link>
          </Button>
        }
      />

      <section className="desk-stack-sm" aria-labelledby="form-link-heading">
        <div className="desk-section-head" style={{ borderBottom: 0, paddingBottom: 0 }}>
          <h2 className="desk-section-title" id="form-link-heading">
            The link
          </h2>
          <p className="desk-section-note">Share once · same link for every student</p>
        </div>

        {formLinkQuery.isLoading ? (
          <div className="desk-stack-sm" aria-busy="true">
            <p className="desk-loading-note">Reading the link</p>
            <div className="desk-skel" style={{ height: 52 }} />
          </div>
        ) : formLinkQuery.isError ? (
          <InlineAlert
            title="The link is unavailable"
            message={
              formLinkQuery.error instanceof Error ? formLinkQuery.error.message : "Request failed."
            }
            tone="error"
            actions={
              <Button size="sm" variant="outline" onClick={() => void formLinkQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : (
          <div className="desk-slip">
            <p className="desk-slip-url" aria-live="polite">
              {formUrl ?? "The link is being issued…"}
            </p>
            <div className="desk-row" style={{ gap: 8 }}>
              <Button onClick={handleCopy} size="sm" disabled={!formUrl}>
                {copied ? (
                  <Check size={13} strokeWidth={2} aria-hidden="true" />
                ) : (
                  <Copy size={13} strokeWidth={1.8} aria-hidden="true" />
                )}
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={formUrl || "#"} rel="noreferrer" target="_blank">
                  <ExternalLink size={13} strokeWidth={1.8} aria-hidden="true" />
                  Open form
                </a>
              </Button>
            </div>
          </div>
        )}

        {!showRegenerateConfirm ? (
          <div className="desk-row">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowRegenerateConfirm(true)}
              disabled={formLinkQuery.isLoading}
            >
              <RefreshCw size={13} strokeWidth={1.8} aria-hidden="true" />
              Regenerate link
            </Button>
            <p className="desk-help" style={{ color: "var(--paper-mid)" }}>
              Invalidate the current link and issue a new one.
            </p>
          </div>
        ) : (
          <div className="desk-note" data-tone="error">
            <div className="desk-stack-sm">
              <p className="desk-note-title">Regenerating invalidates the link students already have</p>
              <p className="desk-note-body">
                Anyone who opens the old link after this will see an expired-link page. Responses already
                submitted are kept.
              </p>
              <div className="desk-row" style={{ gap: 8 }}>
                <Button size="sm" onClick={handleRegenerate} disabled={regenerateMutation.isPending}>
                  {regenerateMutation.isPending ? "Regenerating…" : "Yes, regenerate the link"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowRegenerateConfirm(false)}
                  disabled={regenerateMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="desk-stack-sm" aria-labelledby="collection-heading">
        <div className="desk-section-head">
          <h2 className="desk-section-title" id="collection-heading">
            Collection
          </h2>
          <p className="desk-section-note">
            {valid} of {total} answered
          </p>
        </div>

        {formStatusQuery.isError ? (
          <InlineAlert
            title="Collection counts are unavailable"
            message={
              formStatusQuery.error instanceof Error
                ? formStatusQuery.error.message
                : "Form status request failed."
            }
            tone="error"
          />
        ) : null}

        {formStatusQuery.isLoading ? (
          <div className="desk-stack-sm" aria-busy="true">
            <p className="desk-loading-note">Counting responses</p>
            <div className="desk-skel" style={{ height: 76 }} />
          </div>
        ) : null}

        {status ? (
          <div className="desk-stack-sm">
            <p className="desk-figure-value" style={{ fontSize: 34 }}>
              {percentage.toFixed(percentage % 1 === 0 ? 0 : 1)}%
            </p>
            <span className="desk-meter">
              <span style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} />
            </span>
            <div className="desk-figures">
              <div className="desk-figure">
                <p className="desk-figure-label">Total Students</p>
                <p className="desk-figure-value">{total}</p>
              </div>
              <div className="desk-figure">
                <p className="desk-figure-label">Valid Responses</p>
                <p className="desk-figure-value">{valid}</p>
              </div>
              <div className="desk-figure">
                <p className="desk-figure-label">Invalid Responses</p>
                <p className="desk-figure-value">{status.invalid_responses}</p>
              </div>
              <div className="desk-figure">
                <p className="desk-figure-label">Outstanding</p>
                <p className="desk-figure-value">{pendingCount}</p>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="desk-stack-sm" aria-labelledby="segment-completion-heading">
        <div className="desk-section-head">
          <h2 className="desk-section-title" id="segment-completion-heading">
            Completion by Segment
          </h2>
          <p className="desk-section-note">A segment is ready when everyone in it has answered</p>
        </div>
        <DataTable
          caption="Completion by segment"
          columns={segmentColumns}
          emptyText={
            formStatusQuery.isLoading
              ? "Loading segment completion…"
              : "No segment-level form data available."
          }
          getRowId={(row) => row.segment_key}
          rows={status?.by_segment ?? []}
        />
      </section>

      <section className="desk-stack-sm" aria-labelledby="non-submitters-heading">
        <div className="desk-section-head">
          <h2 className="desk-section-title" id="non-submitters-heading">
            Non-submitters
          </h2>
          <div className="desk-row" style={{ gap: 10 }}>
            <p className="desk-section-note">
              {nonSubmittersQuery.data?.total_count ?? 0} outstanding
            </p>
            <Button
              disabled={!nonSubmittersQuery.data || nonSubmittersQuery.data.total_count === 0}
              size="sm"
              variant="outline"
              onClick={() => {
                const rows = nonSubmittersQuery.data?.non_submitters ?? [];
                const csv = [
                  "admission_number,full_name,segment_key",
                  ...rows.map(
                    (row) => `${row.admission_number},${JSON.stringify(row.full_name)},${row.segment_key}`,
                  ),
                ].join("\n");
                triggerCsvDownload("non_submitters.csv", csv);
              }}
            >
              Export CSV
            </Button>
          </div>
        </div>

        {nonSubmittersQuery.isError ? (
          <InlineAlert
            title="The chase list is unavailable"
            message={
              nonSubmittersQuery.error instanceof Error
                ? nonSubmittersQuery.error.message
                : "Non-submitter request failed."
            }
            tone="error"
          />
        ) : null}

        {nonSubmittersQuery.isSuccess && nonSubmittersQuery.data.total_count === 0 ? (
          <EmptyState
            tone="good"
            title="Every student has answered"
            line="Nothing to chase. New students added to the roster will appear here until they submit."
          />
        ) : (
          <DataTable
            caption="Students who have not responded"
            columns={nonSubmitterColumns}
            emptyText={
              nonSubmittersQuery.isLoading ? "Loading non-submitters…" : "No pending non-submitters."
            }
            getRowId={(row) => row.admission_number}
            rows={nonSubmittersQuery.data?.non_submitters ?? []}
          />
        )}
      </section>

      <details className="desk-disclosure">
        <summary>The twelve questions (read-only)</summary>
        <div style={{ paddingBottom: 8 }}>
          {QUESTION_CONFIGS.map((question, index) => (
            <article className="desk-q" key={question.id}>
              <p className="desk-q-num">{String(index + 1).padStart(2, "0")}</p>
              <div>
                <h3 className="desk-q-title">{question.title}</h3>
                <p className="desk-help" style={{ marginTop: 2 }}>
                  {question.prompt}
                </p>
                <ul className="desk-q-options">
                  {question.options.map((option) => (
                    <li key={option.value}>{option.label}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </details>
    </section>
  );
}
