export interface FormSubmissionPayload {
  admission_number: string;
  phone_last4: string;
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

export interface PublicFormConfig {
  token_valid: boolean;
  workspace_id: string | null;
  workspace_name: string | null;
  expires_at: string | null;
}

export interface FormLinkResponse {
  form_url: string;
  token: string;
  expires_at: string;
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

// -- Student Diff --

export interface StudentDiffEntry {
  admission_number: string;
  full_name: string;
  action: "insert" | "update" | "soft_delete";
  changes: Record<string, { old: string | null; new: string | null }> | null;
  warnings: string[];
}

export interface StudentImportDiffResponse {
  workspace_id: string;
  total_csv_rows: number;
  valid_csv_rows: number;
  to_insert: number;
  to_update: number;
  to_soft_delete: number;
  unchanged: number;
  validation_errors: InvalidRow[];
  diff_entries: StudentDiffEntry[];
  warnings: string[];
}

export interface StudentImportApplyResponse {
  workspace_id: string;
  inserted: number;
  updated: number;
  soft_deleted: number;
  unchanged: number;
  segments_created: number;
  errors: InvalidRow[];
}

// -- Room Diff --

export interface RoomDiffEntry {
  room_id: string;
  segment_key: string;
  action: "insert" | "update" | "soft_delete";
  changes: Record<string, { old: string | null; new: string | null }> | null;
  warnings: string[];
}

export interface RoomImportDiffResponse {
  workspace_id: string;
  total_csv_rows: number;
  valid_csv_rows: number;
  to_insert: number;
  to_update: number;
  to_soft_delete: number;
  unchanged: number;
  validation_errors: InvalidRow[];
  diff_entries: RoomDiffEntry[];
  warnings: string[];
}

export interface RoomImportApplyResponse {
  workspace_id: string;
  inserted: number;
  updated: number;
  soft_deleted: number;
  unchanged: number;
  errors: InvalidRow[];
}

export interface WorkspaceResponse {
  id: string;
  tenant_id: string;
  name: string;
  status: string;
  source: string;
  is_demo_seeded: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceListResponse {
  workspaces: WorkspaceResponse[];
}

export interface WorkspaceCreateRequest {
  name: string;
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

export interface WorkspaceDashboardResponse {
  workspace: WorkspaceResponse;
  setup_status: DashboardSetupStatus;
  form_collection_stats: DashboardFormCollectionStats;
  segments_status: DashboardSegmentsStatus;
  latest_matching_run: DashboardLatestRun;
  generated_data_warning?: {
    generated_profiles_count: number;
    has_generated_data: boolean;
  };
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

export type FactorClaimScope = "room_shared_claim" | "student_specific_claim";

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
  has_generated_profiles?: boolean;
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
  has_generated_profiles?: boolean;
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
  has_generated_profiles?: boolean;
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

// ---------------------------------------------------------------------------
// Auth token injection
// ---------------------------------------------------------------------------
// AuthProvider calls setApiToken() whenever the token changes.
// This avoids threading token through every hook.
let _apiToken: string | null = null;

export function setApiToken(token: string | null): void {
  _apiToken = token;
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
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (_apiToken) {
    headers["Authorization"] = `Bearer ${_apiToken}`;
  }
  const response = await fetch(buildUrl(path), { ...init, headers });
  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(extractErrorMessage(data));
  }

  return data as T;
}

function parseCsvFileName(
  contentDisposition: string | null,
  fallback: string,
): string {
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

// -- Public Form API --

export async function getPublicFormConfig(token: string): Promise<PublicFormConfig> {
  const response = await fetch(buildUrl(`/api/public/forms/${encodeURIComponent(token)}`));
  const data = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(extractErrorMessage(data));
  }
  return data as PublicFormConfig;
}

export async function submitPublicForm(
  token: string,
  payload: FormSubmissionPayload,
): Promise<FormSubmissionResult> {
  const response = await fetch(buildUrl(`/api/public/forms/${encodeURIComponent(token)}/submit`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(extractErrorMessage(data));
  }
  return data as FormSubmissionResult;
}

export async function getDashboardSummary(): Promise<DashboardResponse> {
  return requestJson<DashboardResponse>("/api/dashboard");
}

export async function getWorkspaces(): Promise<WorkspaceListResponse> {
  return requestJson<WorkspaceListResponse>("/api/workspaces");
}

export async function createWorkspace(
  body: WorkspaceCreateRequest,
): Promise<WorkspaceResponse> {
  return requestJson<WorkspaceResponse>("/api/workspaces", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function getWorkspace(
  workspaceId: string,
): Promise<WorkspaceResponse> {
  return requestJson<WorkspaceResponse>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}`,
  );
}

export async function getWorkspaceDashboard(
  workspaceId: string,
): Promise<WorkspaceDashboardResponse> {
  return requestJson<WorkspaceDashboardResponse>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/dashboard`,
  );
}

// -- Form Link API --

export async function getWorkspaceFormLink(workspaceId: string): Promise<FormLinkResponse> {
  return requestJson<FormLinkResponse>(`/api/workspaces/${encodeURIComponent(workspaceId)}/form-link`);
}

export async function regenerateWorkspaceFormLink(workspaceId: string): Promise<FormLinkResponse> {
  return requestJson<FormLinkResponse>(`/api/workspaces/${encodeURIComponent(workspaceId)}/form-link/regenerate`, {
    method: "POST"
  });
}

export async function getSegments(workspaceId: string): Promise<SegmentListResponse> {
  return requestJson<SegmentListResponse>(`/api/workspaces/${encodeURIComponent(workspaceId)}/segments`);
}

export async function getFormStatus(workspaceId: string): Promise<FormStatusResponse> {
  return requestJson<FormStatusResponse>(`/api/workspaces/${encodeURIComponent(workspaceId)}/collection/status`);
}

export async function getNonSubmitters(workspaceId: string): Promise<NonSubmittersResponse> {
  return requestJson<NonSubmittersResponse>(`/api/workspaces/${encodeURIComponent(workspaceId)}/collection/non-submitters`);
}

// -- Workspace-scoped upload (Phase 3) --

export async function previewStudentUpload(
  workspaceId: string,
  file: File,
): Promise<StudentImportDiffResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return requestJson<StudentImportDiffResponse>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/students/upload/preview`,
    { method: "POST", body: formData },
  );
}

export async function applyStudentUpload(
  workspaceId: string,
  file: File,
): Promise<StudentImportApplyResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return requestJson<StudentImportApplyResponse>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/students/upload/apply`,
    { method: "POST", body: formData },
  );
}

export async function previewRoomUpload(
  workspaceId: string,
  file: File,
): Promise<RoomImportDiffResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return requestJson<RoomImportDiffResponse>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/rooms/upload/preview`,
    { method: "POST", body: formData },
  );
}

export async function applyRoomUpload(
  workspaceId: string,
  file: File,
): Promise<RoomImportApplyResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return requestJson<RoomImportApplyResponse>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/rooms/upload/apply`,
    { method: "POST", body: formData },
  );
}

// DEPRECATED: Phase 3+ uses workspace-scoped endpoints
export async function uploadStudentsCsv(
  file: File,
): Promise<UploadSummaryResponse> {
  return uploadCsv("/api/students/upload", file);
}

// DEPRECATED: Phase 3+ uses workspace-scoped endpoints
export async function uploadRoomsCsv(
  file: File,
): Promise<UploadSummaryResponse> {
  return uploadCsv("/api/rooms/upload", file);
}

export async function runMatching(
  workspaceId: string,
  payload: MatchingRunRequest,
): Promise<MatchingRunResponse> {
  return requestJson<MatchingRunResponse>(`/api/workspaces/${encodeURIComponent(workspaceId)}/matching/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function getMatchingRuns(workspaceId: string): Promise<MatchingRunListResponse> {
  return requestJson<MatchingRunListResponse>(`/api/workspaces/${encodeURIComponent(workspaceId)}/matching/runs`);
}

export async function getRunRooms(
  workspaceId: string,
  runId: string,
  segmentKey: string,
): Promise<MatchingRunRoomsResponse> {
  return requestJson<MatchingRunRoomsResponse>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/matching/runs/${encodeURIComponent(runId)}/rooms?segment_key=${encodeURIComponent(segmentKey)}`,
  );
}

export async function getRunStudents(
  workspaceId: string,
  runId: string,
  segmentKey: string,
): Promise<MatchingRunStudentsResponse> {
  return requestJson<MatchingRunStudentsResponse>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/matching/runs/${encodeURIComponent(runId)}/students?segment_key=${encodeURIComponent(segmentKey)}`,
  );
}

export interface MatchingRunAllSegmentsStudentsResponse {
  segments: {
    segment_key: string;
    students: RunStudentRow[];
  }[];
}

export async function getRunStudentsAllSegments(
  workspaceId: string,
  runId: string,
): Promise<MatchingRunAllSegmentsStudentsResponse> {
  return requestJson<MatchingRunAllSegmentsStudentsResponse>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/matching/runs/${encodeURIComponent(runId)}/students/all-segments`,
  );
}

export async function getFairnessReport(
  workspaceId: string,
  runId: string,
): Promise<FairnessReportResponse> {
  return requestJson<FairnessReportResponse>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/fairness/${encodeURIComponent(runId)}`,
  );
}

export async function getSegmentStudents(
  workspaceId: string,
  segmentKey: string,
): Promise<SegmentStudentsResponse> {
  return requestJson<SegmentStudentsResponse>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/segments/${encodeURIComponent(segmentKey)}/students`,
  );
}

export async function runCheckerCompatibility(
  workspaceId: string,
  payload: CheckerRequestPayload,
): Promise<CheckerResponse> {
  return requestJson<CheckerResponse>(`/api/workspaces/${encodeURIComponent(workspaceId)}/checker/compatibility`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function exportAssignmentsCsv(
  workspaceId: string,
  runId: string,
  segmentKey?: string,
): Promise<AssignmentsCsvExportResult> {
  const query = segmentKey
    ? `?segment_key=${encodeURIComponent(segmentKey)}`
    : "";
  const headers: Record<string, string> = {};
  if (_apiToken) {
    headers["Authorization"] = `Bearer ${_apiToken}`;
  }
  const response = await fetch(
    buildUrl(`/api/workspaces/${encodeURIComponent(workspaceId)}/exports/assignments/${encodeURIComponent(runId)}${query}`),
    { headers }
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

// DEPRECATED: Error reports are no longer written to disk.
// Validation errors are returned inline in the diff preview response.
export function getErrorReportDownloadUrl(reportName: string): string {
  return buildUrl(
    `/api/upload/error-reports/${encodeURIComponent(reportName)}`,
  );
}

export async function magicFillWorkspace(
  workspaceId: string,
  segmentKey?: string | null,
): Promise<{
  workspace_id: string;
  segment_key: string | null;
  profiles_created: number;
  students_skipped: number;
}> {
  const body: Record<string, string | null> = {};
  if (segmentKey) {
    body.segment_key = segmentKey;
  }
  const res = await fetch(buildUrl(`/api/workspaces/${encodeURIComponent(workspaceId)}/magic-fill`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(_apiToken ? { Authorization: `Bearer ${_apiToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Magic Fill failed.");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Platform / God-Mode types  (Phase 7)
// ---------------------------------------------------------------------------

export interface PlatformTenantRow {
  id: string;
  slug: string;
  display_name: string;
  contact_email: string | null;
  is_demo: boolean;
  demo_expires_at: string | null;
  created_at: string;
  workspace_count: number;
}

export interface PlatformTenantListResponse {
  tenants: PlatformTenantRow[];
  total: number;
}

export interface PlatformWorkspaceRow {
  id: string;
  name: string;
  status: string;
  source: string;
  is_demo_seeded: boolean;
  created_at: string;
}

export interface PlatformWorkspaceListResponse {
  tenant_id: string;
  workspaces: PlatformWorkspaceRow[];
}

export interface ImpersonateRequest {
  workspace_id: string;
}

export interface ImpersonateResponse {
  token: string;
  tenant_id: string;
  workspace_id: string;
  expires_in_hours: number;
}

// ---------------------------------------------------------------------------
// Platform API functions  (Phase 7)
// ---------------------------------------------------------------------------

export async function getPlatformTenants(
  includeDemo = false,
): Promise<PlatformTenantListResponse> {
  const qs = includeDemo ? "?include_demo=true" : "";
  return requestJson<PlatformTenantListResponse>(`/api/platform/tenants${qs}`);
}

export async function getPlatformTenant(tenantId: string): Promise<PlatformTenantRow> {
  return requestJson<PlatformTenantRow>(`/api/platform/tenants/${encodeURIComponent(tenantId)}`);
}

export async function getPlatformTenantWorkspaces(
  tenantId: string,
): Promise<PlatformWorkspaceListResponse> {
  return requestJson<PlatformWorkspaceListResponse>(
    `/api/platform/tenants/${encodeURIComponent(tenantId)}/workspaces`,
  );
}

export async function impersonateTenant(
  tenantId: string,
  workspaceId: string,
): Promise<ImpersonateResponse> {
  return requestJson<ImpersonateResponse>(
    `/api/platform/tenants/${encodeURIComponent(tenantId)}/impersonate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: workspaceId } satisfies ImpersonateRequest),
    },
  );
}
