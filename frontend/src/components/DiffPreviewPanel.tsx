import { useMemo, useState } from "react";
import { type InvalidRow } from "../lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { DataTable, type DataTableColumn } from "./DataTable";
import { StatCard } from "./StatCard";
import { InlineAlert } from "./InlineAlert";
import { AlertCircle, AlertTriangle, ArrowRight } from "lucide-react";

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
  validationErrors: InvalidRow[];
  diffEntries: UnifiedDiffEntry[];
  workspaceWarnings: string[];
  onConfirm: () => void;
  onCancel: () => void;
  isApplying: boolean;
}

export function DiffPreviewPanel({
  title,
  toInsert,
  toUpdate,
  toSoftDelete,
  unchanged,
  validationErrors,
  diffEntries,
  workspaceWarnings,
  onConfirm,
  onCancel,
  isApplying,
}: DiffPreviewPanelProps): JSX.Element {
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const diffColumns = useMemo<DataTableColumn<UnifiedDiffEntry>[]>(() => {
    return [
      {
        key: "identifier",
        header: "ID",
        cell: (row) => <span className="font-medium">{row.identifier}</span>,
      },
      {
        key: "name",
        header: "Name / Segment",
        cell: (row) => row.name,
      },
      {
        key: "action",
        header: "Action",
        cell: (row) => {
          if (row.action === "insert") {
            return (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                Insert
              </span>
            );
          }
          if (row.action === "update") {
            return (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                Update
              </span>
            );
          }
          if (row.action === "soft_delete") {
            return (
              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                Remove
              </span>
            );
          }
          return <span>{row.action}</span>;
        },
      },
      {
        key: "changes",
        header: "Changes",
        cell: (row) => {
          if (!row.changes || Object.keys(row.changes).length === 0) {
            return <span className="text-muted-foreground">-</span>;
          }
          return (
            <div className="flex flex-col gap-1 text-sm">
              {Object.entries(row.changes).map(([field, vals]) => (
                <div key={field} className="flex items-center gap-2">
                  <span className="font-medium text-muted-foreground">{field}:</span>
                  <span className="line-through text-red-500/70">{vals.old ?? "null"}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-green-600">{vals.new ?? "null"}</span>
                </div>
              ))}
            </div>
          );
        },
      },
      {
        key: "warnings",
        header: "Warnings",
        cell: (row) => {
          if (!row.warnings || row.warnings.length === 0) {
            return null;
          }
          return (
            <div className="flex flex-col gap-1">
              {row.warnings.map((w, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  {w}
                </span>
              ))}
            </div>
          );
        },
      },
    ];
  }, []);

  const invalidColumns: DataTableColumn<InvalidRow>[] = [
    {
      key: "row_number",
      header: "Row",
      cell: (row) => row.row_number,
    },
    {
      key: "field",
      header: "Field",
      cell: (row) => row.field,
    },
    {
      key: "reason",
      header: "Reason",
      cell: (row) => row.reason,
    },
    {
      key: "raw_value",
      header: "Raw Value",
      cell: (row) => row.raw_value ?? "-",
    },
  ];

  return (
    <Card className="border-border/80 bg-white/90">
      <CardHeader className="space-y-3 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} disabled={isApplying}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirm} disabled={isApplying}>
              {isApplying ? "Applying..." : "Confirm & Apply"}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Adding" value={toInsert} />
          <StatCard label="Updating" value={toUpdate} />
          <StatCard label="Removing" value={toSoftDelete} />
          <StatCard label="Unchanged" value={unchanged} />
        </div>

        {workspaceWarnings.length > 0 && (
          <div className="space-y-2">
            {workspaceWarnings.map((warning, index) => (
              <InlineAlert key={index} title="Notice" message={warning} tone="warning" />
            ))}
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-5 w-5" />
                <h3 className="font-medium">Validation Errors ({validationErrors.length})</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="bg-white"
                onClick={() => setShowValidationErrors(!showValidationErrors)}
              >
                {showValidationErrors ? "Hide" : "Show"} Errors
              </Button>
            </div>
            {showValidationErrors && (
              <DataTable
                columns={invalidColumns}
                emptyText="No invalid rows."
                getRowId={(row, index) => `${row.row_number}-${row.field}-${index}`}
                rows={validationErrors.slice(0, 50)} // limit to 50 for performance
              />
            )}
          </div>
        )}

        {diffEntries.length > 0 ? (
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-muted-foreground">Changes to be Applied</h3>
            <DataTable
              columns={diffColumns}
              emptyText="No changes."
              getRowId={(row) => row.identifier}
              rows={diffEntries}
            />
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No changes detected. Applying will not modify any existing active records.
          </div>
        )}

      </CardContent>
    </Card>
  );
}
