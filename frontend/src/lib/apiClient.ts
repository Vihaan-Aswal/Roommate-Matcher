export interface FormSubmissionPayload {
  admission_number: string;
  dob: string;
  q1_raw: string;
  q2_raw: string;
  q3_raw: string;
  q4a_raw: string;
  q4b_raw: string;
  q5a_raw: string;
  q5b_raw: string;
  q6_raw: string;
  q7_raw: string;
  q8_raw: string;
  q9_raw: string;
  q10_raw: string;
}

export interface FormSubmissionResult {
  success: boolean;
  message: string;
  code?: string;
  has_preferences?: boolean;
}

export interface InvalidRow {
  row_number: number;
  field: string;
  reason: string;
  raw_value: string | null;
}

export interface UploadSummaryResponse {
  total_rows: number;
  accepted_rows: number;
  rejected_rows: number;
  duplicate_rows: number;
  invalid_rows: InvalidRow[];
  error_report_name: string | null;
}

export interface DashboardSetupStatus {
  master_students_uploaded: boolean;
  rooms_uploaded: boolean;
  forms_collection_started: boolean;
  at_least_one_segment_ready: boolean;
}

export interface DashboardFormCollectionStats {
  total_students: number;
  students_with_valid_preferences: number;
  percentage_complete: number;
}

export interface DashboardSegmentsStatus {
  total_segments: number;
  ready: number;
  impossible: number;
  at_risk: number;
}

export interface DashboardLatestRun {
  run_id: string | null;
  status: string | null;
  created_at: string | null;
}

export interface DashboardResponse {
  setup_status: DashboardSetupStatus;
  form_collection_stats: DashboardFormCollectionStats;
  segments_status: DashboardSegmentsStatus;
  latest_matching_run: DashboardLatestRun;
}

export interface SegmentOverview {
  segment_key: string;
  gender: string;
  year_group: string;
  ac_type: string;
  room_size: number;
  status: string;
  student_count: number;
  total_capacity: number;
  missing_preferences_count: number;
  missing_preferences_ratio: number;
}

export interface SegmentListResponse {
  segments: SegmentOverview[];
}

export interface FormStatusSegmentSummary {
  segment_key: string;
  total: number;
  valid: number;
  percentage: number;
}

export interface FormStatusResponse {
  total_students: number;
  valid_responses: number;
  invalid_responses: number;
  percentage_valid: number;
  by_segment: FormStatusSegmentSummary[];
}

export interface NonSubmitterRow {
  admission_number: string;
  full_name: string;
  segment_key: string;
}

export interface NonSubmittersResponse {
  non_submitters: NonSubmitterRow[];
  total_count: number;
}

export type MatchingRunScope = "segment" | "all_ready_segments";

export interface MatchingRunRequest {
  segment_key: string | null;
  scope: MatchingRunScope;
}

export interface MatchingRunResponse {
  run_id: string;
  scope: MatchingRunScope;
  status: "pending" | "running" | "completed" | "failed";
  message: string;
  segments_matched: number;
}

export interface MatchingRunHistoryRow {
  run_id: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  status: "pending" | "running" | "completed" | "failed";
  scope: MatchingRunScope;
  segments_completed: number;
  error_message: string | null;
}

export interface MatchingRunListResponse {
  runs: MatchingRunHistoryRow[];
}

export type SatisfactionLabel = "Excellent" | "Good" | "Okay" | "Poor";

export type FactorClass =
  | "Strong Match"
  | "Moderate Match"
  | "Neutral"
  | "Moderate Mismatch"
  | "Strong Mismatch";

export type FactorPolarity =
  | "strong_positive"
  | "moderate_positive"
  | "mismatch"
  | "neutral_context";

export type FactorClaimScope =
  | "room_shared_claim"
  | "student_specific_claim";

export interface FactorTraceEntry {
  factor_key: string;
  factor_class: FactorClass;
  reason_bucket: string;
  polarity: FactorPolarity;
  template_id: string;
  claim_scope: FactorClaimScope;
}

export interface RoomViewStudentRow {
  admission_number: string;
  full_name: string;
  pair_scores_with_roommates: Record<string, number>;
}

export interface RunRoomRow {
  room_id: string;
  room_size: number;
  assigned_students: RoomViewStudentRow[];
  group_score: number;
  needs_review: boolean;
}

export interface MatchingRunRoomsResponse {
  run_id: string;
  segment_key: string;
  rooms: RunRoomRow[];
}

export interface RunStudentRow {
  admission_number: string;
  full_name: string;
  room_id: string;
  roommate_ids: string[];
  satisfaction_score: number;
  satisfaction_label: SatisfactionLabel;
  is_at_risk: boolean;
  reasons: string[];
  factor_trace: FactorTraceEntry[];
}

export interface MatchingRunStudentsResponse {
  run_id: string;
  segment_key: string;
  students: RunStudentRow[];
}

export interface SegmentFairnessRow {
  segment_key: string;
  total_students: number;
  label_counts: Record<SatisfactionLabel, number>;
  label_percentages: Record<SatisfactionLabel, number>;
  at_risk_count: number;
  at_risk_student_ids: string[];
  minimum_satisfaction: number;
}

export interface FairnessReportResponse {
  run_id: string;
  total_students: number;
  run_label_counts: Record<SatisfactionLabel, number>;
  run_label_percentages: Record<SatisfactionLabel, number>;
  run_at_risk_count: number;
  run_at_risk_student_ids: string[];
  by_segment: SegmentFairnessRow[];
}

export interface SegmentStudentPreferenceRow {
  admission_number: string;
  full_name: string;
  has_valid_preferences: boolean;
  preference_status: string;
}

export interface SegmentStudentsResponse {
  segment_key: string;
  room_size: number;
  students: SegmentStudentPreferenceRow[];
}

export interface CheckerRequestPayload {
  segment_key: string;
  room_size: number;
  student_ids: string[];
}

export interface CheckerStudentResult {
  admission_number: string;
  satisfaction_score: number;
  satisfaction_label: SatisfactionLabel;
  reasons: string[];
  is_at_risk: boolean;
  factor_trace: FactorTraceEntry[];
}

export interface CheckerResponse {
  group_score: number;
  group_label: SatisfactionLabel;
  at_risk_students: string[];
  students: CheckerStudentResult[];
}

export interface AssignmentsCsvExportResult {
  blob: Blob;
  contentType: string;
  fileName: string;
}

function getApiBaseUrl(): string {
  const value = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return value ? value.replace(/\/$/, "") : "";
}

function buildUrl(path: string): string {
  return `${getApiBaseUrl()}${path}`;
}

function extractErrorMessage(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }

  if (!data || typeof data !== "object") {
    return "Request failed. Please try again.";
  }

  const record = data as Record<string, unknown>;
  const detail = record.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (detail && typeof detail === "object") {
    const detailRecord = detail as Record<string, unknown>;
    if (typeof detailRecord.message === "string") {
      return detailRecord.message;
    }
  }

  if (typeof record.message === "string") {
    return record.message;
  }

  return "Request failed. Please try again.";
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildUrl(path), init);
  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(extractErrorMessage(data));
  }

  return data as T;
}

function parseCsvFileName(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) {
    return fallback;
  }

  const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
  if (!match || !match[1]) {
    return fallback;
  }

  return match[1];
}

async function uploadCsv(
  path: string,
  file: File,
): Promise<UploadSummaryResponse> {
  const formData = new FormData();
  formData.append("file", file);

  return requestJson<UploadSummaryResponse>(path, {
    method: "POST",
    body: formData,
  });
}

export async function submitStudentForm(
  payload: FormSubmissionPayload,
): Promise<FormSubmissionResult> {
  return requestJson<FormSubmissionResult>("/api/form/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function getDashboardSummary(): Promise<DashboardResponse> {
  return requestJson<DashboardResponse>("/api/dashboard");
}

export async function getSegments(): Promise<SegmentListResponse> {
  return requestJson<SegmentListResponse>("/api/segments");
}

export async function getFormStatus(): Promise<FormStatusResponse> {
  return requestJson<FormStatusResponse>("/api/form/status");
}

export async function getNonSubmitters(): Promise<NonSubmittersResponse> {
  return requestJson<NonSubmittersResponse>("/api/form/non-submitters");
}

export async function uploadStudentsCsv(
  file: File,
): Promise<UploadSummaryResponse> {
  return uploadCsv("/api/students/upload", file);
}

export async function uploadRoomsCsv(
  file: File,
): Promise<UploadSummaryResponse> {
  return uploadCsv("/api/rooms/upload", file);
}

export async function runMatching(
  payload: MatchingRunRequest,
): Promise<MatchingRunResponse> {
  return requestJson<MatchingRunResponse>("/api/matching/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function getMatchingRuns(): Promise<MatchingRunListResponse> {
  return requestJson<MatchingRunListResponse>("/api/matching/runs");
}

export async function getRunRooms(
  runId: string,
  segmentKey: string,
): Promise<MatchingRunRoomsResponse> {
  return requestJson<MatchingRunRoomsResponse>(
    `/api/matching/runs/${encodeURIComponent(runId)}/segments/${encodeURIComponent(segmentKey)}/rooms`,
  );
}

export async function getRunStudents(
  runId: string,
  segmentKey: string,
): Promise<MatchingRunStudentsResponse> {
  return requestJson<MatchingRunStudentsResponse>(
    `/api/matching/runs/${encodeURIComponent(runId)}/segments/${encodeURIComponent(segmentKey)}/students`,
  );
}

export async function getFairnessReport(
  runId: string,
): Promise<FairnessReportResponse> {
  return requestJson<FairnessReportResponse>(
    `/api/fairness/${encodeURIComponent(runId)}`,
  );
}

export async function getSegmentStudents(
  segmentKey: string,
): Promise<SegmentStudentsResponse> {
  return requestJson<SegmentStudentsResponse>(
    `/api/segments/${encodeURIComponent(segmentKey)}/students`,
  );
}

export async function runCheckerCompatibility(
  payload: CheckerRequestPayload,
): Promise<CheckerResponse> {
  return requestJson<CheckerResponse>("/api/checker/compatibility", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function exportAssignmentsCsv(
  runId: string,
  segmentKey?: string,
): Promise<AssignmentsCsvExportResult> {
  const query = segmentKey
    ? `?segment_key=${encodeURIComponent(segmentKey)}`
    : "";
  const response = await fetch(
    buildUrl(`/api/exports/assignments/${encodeURIComponent(runId)}${query}`),
  );

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as unknown;
    throw new Error(extractErrorMessage(data));
  }

  const fileName = parseCsvFileName(
    response.headers.get("content-disposition"),
    segmentKey
      ? `assignments_${runId}_${segmentKey}.csv`
      : `assignments_${runId}.csv`,
  );

  return {
    blob: await response.blob(),
    contentType: response.headers.get("content-type") ?? "text/csv",
    fileName,
  };
}

export function getErrorReportDownloadUrl(reportName: string): string {
  return buildUrl(
    `/api/upload/error-reports/${encodeURIComponent(reportName)}`,
  );
}
