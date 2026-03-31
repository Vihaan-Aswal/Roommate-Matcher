import { useMemo, useState } from "react";

import { AdminPageHeader } from "../components/AdminPageHeader";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { FileUploadPanel } from "../components/FileUploadPanel";
import { InlineAlert } from "../components/InlineAlert";
import { StatCard } from "../components/StatCard";
import { getErrorReportDownloadUrl, type UploadSummaryResponse } from "../lib/apiClient";
import { useAdminFormStatusQuery } from "../hooks/useAdminFormCollection";
import {
  useUploadRoomsMutation,
  useUploadStudentsMutation,
} from "../hooks/useAdminUploads";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

interface CsvPreviewRow {
  id: string;
  values: Record<string, string>;
}

interface CsvPreviewState {
  headers: string[];
  rows: CsvPreviewRow[];
  parseError: string | null;
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const nextChar = line[index + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current.trim());
  return fields;
}

async function parseCsvPreview(file: File): Promise<CsvPreviewState> {
  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { headers: [], rows: [], parseError: "The selected CSV appears empty." };
  }

  const rawHeaders = splitCsvLine(lines[0]);
  const headers = rawHeaders.map((header, index) =>
    header.length > 0 ? header : `column_${index + 1}`,
  );

  const rows = lines.slice(1, 11).map((line, rowIndex) => {
    const fields = splitCsvLine(line);
    const values: Record<string, string> = {};

    headers.forEach((header, index) => {
      values[header] = fields[index] ?? "";
    });

    return {
      id: `preview-${rowIndex}`,
      values,
    };
  });

  return { headers, rows, parseError: null };
}

interface UploadSummaryPanelProps {
  title: string;
  summary: UploadSummaryResponse;
}

function UploadSummaryPanel({ title, summary }: UploadSummaryPanelProps): JSX.Element {
  const invalidColumns: DataTableColumn<UploadSummaryResponse["invalid_rows"][number]>[] = [
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
      <CardHeader className="space-y-3">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Rows" value={summary.total_rows} />
          <StatCard label="Accepted" value={summary.accepted_rows} />
          <StatCard label="Rejected" value={summary.rejected_rows} />
          <StatCard label="Duplicates" value={summary.duplicate_rows} />
        </div>

        {summary.error_report_name ? (
          <Button asChild size="sm" variant="outline">
            <a href={getErrorReportDownloadUrl(summary.error_report_name)}>
              Download Error Report
            </a>
          </Button>
        ) : null}

        <DataTable
          columns={invalidColumns}
          emptyText="No invalid rows reported in this upload."
          getRowId={(row, index) => `${row.row_number}-${row.field}-${index}`}
          rows={summary.invalid_rows.slice(0, 10)}
        />
      </CardContent>
    </Card>
  );
}

export function AdminStudentsData(): JSX.Element {
  const studentsUpload = useUploadStudentsMutation();
  const roomsUpload = useUploadRoomsMutation();
  const formStatusQuery = useAdminFormStatusQuery();

  const [studentsSummary, setStudentsSummary] = useState<UploadSummaryResponse | null>(
    null,
  );
  const [roomsSummary, setRoomsSummary] = useState<UploadSummaryResponse | null>(null);
  const [studentsPreview, setStudentsPreview] = useState<CsvPreviewState>({
    headers: [],
    rows: [],
    parseError: null,
  });

  const studentsPreviewColumns = useMemo<DataTableColumn<CsvPreviewRow>[]>(
    () =>
      studentsPreview.headers.map((header) => ({
        key: header,
        header,
        cell: (row) => row.values[header] ?? "",
      })),
    [studentsPreview.headers],
  );

  return (
    <section className="space-y-6">
      <AdminPageHeader
        title="Students & Data"
        description="Upload master students and room inventory CSV files. Upload responses are authoritative and dependent views are automatically refreshed after each upload."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <FileUploadPanel
          title="Master Students CSV"
          description="Upload the canonical students file with exact column names."
          buttonLabel="Upload Students"
          isUploading={studentsUpload.isPending}
          onFileSelected={(file) => {
            if (!file) {
              setStudentsPreview({ headers: [], rows: [], parseError: null });
              return;
            }

            void parseCsvPreview(file).then(setStudentsPreview).catch(() => {
              setStudentsPreview({
                headers: [],
                rows: [],
                parseError: "Could not parse the selected file for preview.",
              });
            });
          }}
          onUpload={async (file) => {
            const summary = await studentsUpload.mutateAsync(file);
            setStudentsSummary(summary);
          }}
        />

        <FileUploadPanel
          title="Rooms CSV"
          description="Upload room IDs and capacities per segment."
          buttonLabel="Upload Rooms"
          isUploading={roomsUpload.isPending}
          onUpload={async (file) => {
            const summary = await roomsUpload.mutateAsync(file);
            setRoomsSummary(summary);
          }}
        />
      </div>

      {(studentsUpload.error || roomsUpload.error) && (
        <InlineAlert
          title="Upload failed"
          message={
            studentsUpload.error?.message ??
            roomsUpload.error?.message ??
            "An upload request failed."
          }
          tone="error"
        />
      )}

      {studentsUpload.isSuccess || roomsUpload.isSuccess ? (
        <InlineAlert
          title="Upload completed"
          message="The latest upload response has been applied and dependent admin data has been refreshed."
          tone="success"
        />
      ) : null}

      <Card className="border-border/80 bg-white/90">
        <CardHeader>
          <CardTitle className="text-lg">Student CSV Preview (first 10 rows)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {studentsPreview.parseError ? (
            <InlineAlert
              title="Preview unavailable"
              message={studentsPreview.parseError}
              tone="error"
            />
          ) : null}

          <DataTable
            columns={studentsPreviewColumns}
            emptyText="Select a students CSV file to preview header and row data."
            getRowId={(row) => row.id}
            rows={studentsPreview.rows}
          />
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-white/90">
        <CardHeader>
          <CardTitle className="text-lg">Form Validation Snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          {formStatusQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading form status...</p>
          ) : null}
          {formStatusQuery.isError ? (
            <InlineAlert
              title="Unable to load form stats"
              message={
                formStatusQuery.error instanceof Error
                  ? formStatusQuery.error.message
                  : "Form status request failed."
              }
              tone="error"
            />
          ) : null}

          {formStatusQuery.data ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Total Students"
                value={formStatusQuery.data.total_students}
              />
              <StatCard
                label="Valid Responses"
                value={formStatusQuery.data.valid_responses}
              />
              <StatCard
                label="Invalid Responses"
                value={formStatusQuery.data.invalid_responses}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {studentsSummary ? (
        <UploadSummaryPanel title="Students Upload Summary" summary={studentsSummary} />
      ) : null}

      {roomsSummary ? (
        <UploadSummaryPanel title="Rooms Upload Summary" summary={roomsSummary} />
      ) : null}
    </section>
  );
}
