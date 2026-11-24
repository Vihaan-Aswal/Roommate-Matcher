import { useState } from "react";
import { type InvalidRow } from "../lib/apiClient";
import { DataTable, type DataTableColumn } from "./DataTable";
import { StatCard } from "./StatCard";
import { InlineAlert } from "./InlineAlert";
import { EmptyState } from "./EmptyState";
import { Button } from "./ui/button";

export interface UnifiedDiffEntry {
  identifier: string;
  name: string;
  action: string;
  changes: Record<string, { old: string | null; new: string | null }> | null;
  warnings: string[];
}

export interface DiffPreviewPanelProps {
  title: string;
  toInsert: number;
  toUpdate: number;
  toSoftDelete: number;
  unchanged: number;
  validCsvRows: number;
  validationErrors: InvalidRow[];
  diffEntries: UnifiedDiffEntry[];
  workspaceWarnings: string[];
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isApplying: boolean;
}

function ActionChip({ action }: { action: string }): JSX.Element {
  if (action === "insert") {
    return <span className="desk-chip" data-tone="mark">Insert</span>;
  }
  if (action === "update") {
    return <span className="desk-chip">Update</span>;
  }
  if (action === "soft_delete") {
    return <span className="desk-chip" data-tone="attention">Remove</span>;
  }
  return <span className="desk-chip" data-tone="quiet">{action}</span>;
}

/**
 * The proof sheet: what will change, what is wrong, and the two ways out.
 * Nothing is written until Confirm & Apply.
 */
export function DiffPreviewPanel({
  title,
  toInsert,
  toUpdate,
  toSoftDelete,
  unchanged,
  validCsvRows,
  validationErrors,
  diffEntries,
  workspaceWarnings,
  onConfirm,
  onCancel,
  isApplying,
}: DiffPreviewPanelProps): JSX.Element {
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const diffColumns: DataTableColumn<UnifiedDiffEntry>[] = [
    {
      key: "identifier",
      header: "ID",
      cell: (row) => <span className="desk-mono">{row.identifier}</span>,
    },
    {
      key: "name",
      header: "Name / Segment",
      cell: (row) => row.name,
    },
    {
      key: "action",
      header: "Action",
      cell: (row) => <ActionChip action={row.action} />,
    },
    {
      key: "changes",
      header: "Changes",
      cell: (row) => {
        if (!row.changes || Object.keys(row.changes).length === 0) {
          return <span style={{ color: "var(--paper-mid)" }}>—</span>;
        }
        return (
          <div className="desk-stack-sm" style={{ gap: 3 }}>
            {Object.entries(row.changes).map(([field, vals]) => (
              <div key={field} className="desk-mono" style={{ fontSize: 11.5 }}>
                <span style={{ color: "var(--paper-mid)" }}>{field}: </span>
                <span style={{ color: "var(--wax)", textDecoration: "line-through" }}>
                  {vals.old ?? "null"}
                </span>
                <span style={{ color: "var(--paper-mid)" }}> → </span>
                <span>{vals.new ?? "null"}</span>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: "warnings",
      header: "Warnings",
      cell: (row) =>
        !row.warnings || row.warnings.length === 0 ? null : (
          <div className="desk-stack-sm" style={{ gap: 3 }}>
            {row.warnings.map((warning, index) => (
              <span key={index} className="desk-help" style={{ color: "var(--wax)" }}>
                {warning}
              </span>
            ))}
          </div>
        ),
    },
  ];

  const invalidColumns: DataTableColumn<InvalidRow>[] = [
    { key: "row_number", header: "Row", cell: (row) => <span className="desk-mono">{row.row_number}</span> },
    { key: "field", header: "Field", cell: (row) => row.field },
    { key: "reason", header: "Reason", cell: (row) => row.reason },
    { key: "raw_value", header: "Raw value", cell: (row) => <span className="desk-mono">{row.raw_value ?? "—"}</span> },
  ];

  return (
    <section className="desk-sheet desk-stack m-fade" aria-labelledby="diff-title">
      <div className="desk-row-between">
        <div>
          <p className="desk-overline">Step 2 of 3 · review</p>
          <h2 className="desk-section-title" id="diff-title" style={{ marginTop: 4 }}>
            {title}
          </h2>
        </div>
        <div className="desk-row" style={{ gap: 8 }}>
          <Button variant="outline" onClick={onCancel} disabled={isApplying}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              void Promise.resolve(onConfirm()).catch(() => {
                // The caller renders the apply error next to the preview.
              });
            }}
            disabled={isApplying || validCsvRows === 0}
          >
            {isApplying ? "Applying…" : "Confirm & Apply"}
          </Button>
        </div>
      </div>

      <p className="desk-help" style={{ maxWidth: "62ch" }}>
        Nothing has been written yet. Applying replaces the active roster with this file; rows missing
        from the file are removed from the active set, not deleted.
      </p>

      <div className="desk-figures">
        <StatCard label="Adding" value={toInsert} />
        <StatCard label="Updating" value={toUpdate} />
        <StatCard label="Removing" value={toSoftDelete} />
        <StatCard label="Unchanged" value={unchanged} />
      </div>

      {validCsvRows === 0 ? (
        <InlineAlert
          title="No valid rows"
          message="This file has no valid rows, so nothing will be applied."
          tone="error"
        />
      ) : null}

      {workspaceWarnings.length > 0 ? (
        <div className="desk-stack-sm">
          {workspaceWarnings.map((warning, index) => (
            <InlineAlert key={index} title="Notice" message={warning} tone="info" />
          ))}
        </div>
      ) : null}

      {validationErrors.length > 0 ? (
        <div className="desk-stack-sm" style={{ background: "rgba(111,30,34,0.06)", padding: "12px 14px", borderRadius: 6 }}>
          <div className="desk-row-between">
            <p className="desk-note-title" style={{ color: "var(--wax)" }}>
              {validationErrors.length} row{validationErrors.length === 1 ? "" : "s"} cannot be read
            </p>
            <Button variant="outline" size="sm" onClick={() => setShowValidationErrors(!showValidationErrors)}>
              {showValidationErrors ? "Hide" : "Show"} the rows
            </Button>
          </div>
          <p className="desk-help">
            {validCsvRows === 0
              ? "No row in this file is valid, so there is nothing to apply."
              : "Invalid rows are skipped. The rest of the file still applies — check these before confirming."}
          </p>
          {showValidationErrors ? (
            <DataTable
              caption="Invalid rows"
              columns={invalidColumns}
              emptyText="No invalid rows."
              getRowId={(row, index) => `${row.row_number}-${row.field}-${index}`}
              rows={validationErrors.slice(0, 50)}
            />
          ) : null}
        </div>
      ) : null}

      {diffEntries.length > 0 ? (
        <div>
          <div className="desk-section-head">
            <h3 className="desk-section-title" style={{ fontSize: "1rem" }}>
              Changes to be applied
            </h3>
            <p className="desk-section-note">
              {diffEntries.length} row{diffEntries.length === 1 ? "" : "s"}
            </p>
          </div>
          <DataTable
            caption={title}
            columns={diffColumns}
            emptyText="No changes."
            getRowId={(row) => row.identifier}
            rows={diffEntries}
          />
        </div>
      ) : (
        <EmptyState
          title="No changes detected"
          line="This file matches what is already in the workspace. Applying it will not modify any active record."
        />
      )}
    </section>
  );
}
