// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyRoomUpload,
  applyStudentUpload,
  createWorkspace,
  exportAssignmentsCsv,
  getFairnessReport,
  getFormStatus,
  getMatchingRuns,
  getNonSubmitters,
  getPlatformTenant,
  getPlatformTenants,
  getPlatformTenantWorkspaces,
  getPublicFormConfig,
  getRunRooms,
  getRunStudents,
  getRunStudentsAllSegments,
  getSegmentStudents,
  getSegments,
  getWorkspaceDashboard,
  getWorkspaceFormLink,
  getWorkspaces,
  impersonateTenant,
  magicFillWorkspace,
  previewRoomUpload,
  previewStudentUpload,
  regenerateWorkspaceFormLink,
  runCheckerCompatibility,
  runMatching,
  setApiToken,
  submitPublicForm,
  type FormSubmissionPayload,
} from "../../lib/apiClient";

/**
 * The transport boundary (global fetch) is the only thing mocked. Everything
 * below it — URL building, auth header injection, body encoding, error-envelope
 * parsing, blob/CSV download — is the real code.
 */
const BASE_URL = "https://api.test";
const fetchMock = vi.fn();

interface FakeResponse {
  status?: number;
  ok?: boolean;
  headers?: Record<string, string>;
  json?: unknown;
  /** Simulate a body that is not JSON (204, HTML error page, empty stream). */
  invalidJson?: boolean;
  blob?: Blob;
}

function fakeResponse(init: FakeResponse = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: init.ok ?? status < 400,
    status,
    headers: new Headers(init.headers),
    json: async () => {
      if (init.invalidJson) {
        throw new SyntaxError("Unexpected token < in JSON");
      }
      return init.json ?? null;
    },
    blob: async () => init.blob ?? new Blob(["unused"]),
  } as unknown as Response;
}

function respond(init: FakeResponse = {}): void {
  fetchMock.mockResolvedValueOnce(fakeResponse(init));
}

interface RecordedRequest {
  url: string;
  init: RequestInit;
}

function lastRequest(): RecordedRequest {
  const call = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url: call[0] as string, init: (call[1] ?? {}) as RequestInit };
}

function bodyJson<T = Record<string, unknown>>(init: RequestInit): T {
  return JSON.parse(init.body as string) as T;
}

function payload(): FormSubmissionPayload {
  return {
    admission_number: "ADM-001",
    phone_last4: "4321",
    q1_raw: "Before 11 PM (early)",
    q2_raw: "Tidy",
    q3_raw: "Alarm",
    q4a_raw: "Quiet",
    q4b_raw: "Rarely",
    q5a_raw: "Low",
    q5b_raw: "Library",
    q6_raw: "Early sleeper",
    q7_raw: "Same routine",
    q8_raw: "Shared cleaning",
    q9_raw: "Under 5000",
    q10_raw: "Similar",
  };
}

beforeAll(() => {
  // A trailing slash proves the base URL is normalised before paths are joined.
  vi.stubEnv("VITE_API_BASE_URL", `${BASE_URL}/`);
  vi.stubGlobal("fetch", fetchMock);
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  fetchMock.mockReset();
  setApiToken(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("request plumbing", () => {
  it("builds the URL from the configured base and strips a trailing slash", async () => {
    respond({ json: { workspaces: [] } });

    await getWorkspaces();

    expect(lastRequest().url).toBe(`${BASE_URL}/api/workspaces`);
  });

  it("uses a relative URL when no base URL is configured", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    try {
      respond({ json: { workspaces: [] } });

      await getWorkspaces();

      expect(lastRequest().url).toBe("/api/workspaces");
    } finally {
      vi.stubEnv("VITE_API_BASE_URL", `${BASE_URL}/`);
    }
  });

  it("sends the bearer token set by setApiToken and nothing when cleared", async () => {
    setApiToken("token-abc");
    respond({ json: { workspaces: [] } });

    await getWorkspaces();
    expect(lastRequest().init.headers).toEqual({ Authorization: "Bearer token-abc" });

    setApiToken(null);
    respond({ json: { workspaces: [] } });

    await getWorkspaces();
    expect(lastRequest().init.headers).toEqual({});
  });

  const errorBodies: Array<[string, unknown, string]> = [
    ["a plain-text body", "Service unavailable", "Service unavailable"],
    ["a null body", null, "Request failed. Please try again."],
    ["a numeric body", 42, "Request failed. Please try again."],
    ["a FastAPI detail string", { detail: "You do not access this workspace" }, "You do not access this workspace"],
    ["a nested detail object", { detail: { message: "Run is still pending" } }, "Run is still pending"],
    ["a top-level message", { message: "Import failed" }, "Import failed"],
    ["an unrecognised object", { error: "nope" }, "Request failed. Please try again."],
    ["a detail object without a message", { detail: { code: "E1" } }, "Request failed. Please try again."],
    [
      "a FastAPI validation array",
      { detail: [{ loc: ["body", "name"], msg: "field required", type: "missing" }] },
      "name: field required",
    ],
    ["a detail array of strings", { detail: ["first problem", "second"] }, "first problem"],
    ["an empty detail array", { detail: [] }, "Request failed. Please try again."],
    ["an array body", ["bad"], "Request failed. Please try again."],
  ];

  it.each(errorBodies)("turns %s into a readable Error", async (_label, body, message) => {
    respond({ status: 400, json: body });

    await expect(getWorkspaces()).rejects.toThrow(message);
  });

  it("falls back to the generic message when the error body is not JSON", async () => {
    respond({ status: 502, invalidJson: true });

    await expect(getWorkspaces()).rejects.toThrow("Request failed. Please try again.");
  });

  it("returns an empty body as null rather than throwing", async () => {
    respond({ status: 204, json: undefined });

    await expect(regenerateWorkspaceFormLink("ws-1")).resolves.toBeNull();
  });
});

describe("public form API", () => {
  it("maps the public config onto the UI shape and encodes the token", async () => {
    respond({
      json: { token_valid: true, workspace_display_name: "Block A Hostel" },
    });

    const config = await getPublicFormConfig("tok/en 1");

    expect(lastRequest().url).toBe(`${BASE_URL}/api/public/forms/tok%2Fen%201`);
    expect(config).toEqual({
      token_valid: true,
      workspace_id: null,
      workspace_name: "Block A Hostel",
      expires_at: null,
    });
  });

  it("defaults missing config fields instead of inventing a workspace", async () => {
    respond({ json: {} });

    const config = await getPublicFormConfig("tok");

    expect(config).toEqual({
      token_valid: false,
      workspace_id: null,
      workspace_name: null,
      expires_at: null,
    });
  });

  it("throws the API reason when the token is rejected", async () => {
    respond({ status: 404, json: { detail: "Form link not found" } });

    await expect(getPublicFormConfig("gone")).rejects.toThrow("Form link not found");
  });

  it("submits identity and answers in the endpoint's own shape", async () => {
    respond({ json: { status: "accepted", valid: true } });

    const result = await submitPublicForm("tok-1", payload());

    const request = lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/public/forms/tok-1/submit`);
    expect(request.init.method).toBe("POST");
    expect(request.init.headers).toEqual({ "Content-Type": "application/json" });

    const body = bodyJson<{
      submitted_admission_number: string;
      submitted_phone_last4: string;
      answers: Record<string, string>;
    }>(request.init);
    expect(body.submitted_admission_number).toBe("ADM-001");
    expect(body.submitted_phone_last4).toBe("4321");
    expect(Object.keys(body.answers).sort()).toEqual(
      [
        "q1_raw",
        "q2_raw",
        "q3_raw",
        "q4a_raw",
        "q4b_raw",
        "q5a_raw",
        "q5b_raw",
        "q6_raw",
        "q7_raw",
        "q8_raw",
        "q9_raw",
        "q10_raw",
      ].sort(),
    );
    expect(body.answers.q9_raw).toBe("Under 5000");
    // Identity travels under submitted_* only, never duplicated inside answers.
    expect(body.answers).not.toHaveProperty("admission_number");
    expect(body.answers).not.toHaveProperty("phone_last4");

    expect(result).toEqual({
      success: true,
      message: "Your response has been recorded. Your latest valid response is the one that counts.",
      code: undefined,
      has_preferences: true,
    });
  });

  const rejectionCopy: Array<[string, string]> = [
    [
      "Verification failed",
      "We could not match that admission number and phone number against the roster. Check both and try again.",
    ],
    ["incomplete_form_submission", "Please answer all questions, then submit again."],
    ["invalid_form_option", "One answer was not recognised. Pick an option for every question."],
    ["form_link_invalid", "This link has expired. Ask the hostel office for the current one."],
    ["something_new", "Your response was not accepted. Check your details and try again."],
  ];

  it.each(rejectionCopy)("translates the %s rejection into student-facing copy", async (code, message) => {
    respond({ json: { valid: false, error: code } });

    const result = await submitPublicForm("tok-1", payload());

    expect(result).toEqual({
      success: false,
      message,
      code,
      has_preferences: false,
    });
  });

  it("treats a response without `valid` as not accepted", async () => {
    respond({ json: {} });

    const result = await submitPublicForm("tok-1", payload());

    expect(result.success).toBe(false);
    expect(result.code).toBeUndefined();
  });

  it("throws when the submit endpoint rejects the request outright", async () => {
    respond({ status: 422, json: { detail: "Answers must cover every question" } });

    await expect(submitPublicForm("tok-1", payload())).rejects.toThrow(
      "Answers must cover every question",
    );
  });
});

describe("workspace and dashboard endpoints", () => {
  it("lists workspaces", async () => {
    const body = { workspaces: [{ id: "ws-1", name: "Main" }] };
    respond({ json: body });

    await expect(getWorkspaces()).resolves.toEqual(body);
    expect(lastRequest()).toMatchObject({ url: `${BASE_URL}/api/workspaces`, init: { headers: {} } });
  });

  it("creates a workspace with a JSON body", async () => {
    const created = { id: "ws-2", name: "New Block", status: "active" };
    respond({ json: created });

    await expect(createWorkspace({ name: "New Block" })).resolves.toEqual(created);

    const request = lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces`);
    expect(request.init.method).toBe("POST");
    expect(request.init.headers).toEqual({ "Content-Type": "application/json" });
    expect(bodyJson(request.init)).toEqual({ name: "New Block" });
  });

  it("reads a workspace dashboard", async () => {
    const dashboard = {
      workspace: { id: "ws-1" },
      setup_status: { master_students_uploaded: true },
    };
    respond({ json: dashboard });

    await expect(getWorkspaceDashboard("ws/1")).resolves.toEqual(dashboard);
    expect(lastRequest().url).toBe(`${BASE_URL}/api/workspaces/ws%2F1/dashboard`);
  });

  it("reads and regenerates the workspace form link", async () => {
    respond({ json: { token: "t1" } });
    await expect(getWorkspaceFormLink("ws-1")).resolves.toEqual({ token: "t1" });
    expect(lastRequest().url).toBe(`${BASE_URL}/api/workspaces/ws-1/form-link`);
    expect(lastRequest().init.method).toBeUndefined();

    respond({ json: { token: "t2" } });
    await expect(regenerateWorkspaceFormLink("ws-1")).resolves.toEqual({ token: "t2" });
    expect(lastRequest().url).toBe(`${BASE_URL}/api/workspaces/ws-1/form-link/regenerate`);
    expect(lastRequest().init.method).toBe("POST");
    expect(lastRequest().init.headers).toEqual({});
  });

  it("reads segments, collection status and non-submitters", async () => {
    respond({ json: { segments: [] } });
    await expect(getSegments("ws-1")).resolves.toEqual({ segments: [] });
    expect(lastRequest().url).toBe(`${BASE_URL}/api/workspaces/ws-1/segments`);

    const status = { total_students: 10, valid_responses: 6 };
    respond({ json: status });
    await expect(getFormStatus("ws-1")).resolves.toEqual(status);
    expect(lastRequest().url).toBe(`${BASE_URL}/api/workspaces/ws-1/collection/status`);

    const nonSubmitters = { non_submitters: [], total_count: 0 };
    respond({ json: nonSubmitters });
    await expect(getNonSubmitters("ws-1")).resolves.toEqual(nonSubmitters);
    expect(lastRequest().url).toBe(`${BASE_URL}/api/workspaces/ws-1/collection/non-submitters`);
  });
});

describe("upload endpoints", () => {
  const file = new File(["admission_number\nADM-1"], "students.csv", { type: "text/csv" });

  it.each([
    ["previewStudentUpload", previewStudentUpload, "students/upload/preview"],
    ["applyStudentUpload", applyStudentUpload, "students/upload/apply"],
    ["previewRoomUpload", previewRoomUpload, "rooms/upload/preview"],
    ["applyRoomUpload", applyRoomUpload, "rooms/upload/apply"],
  ] as const)("%s posts multipart form data", async (_name, call, path) => {
    respond({ json: { workspace_id: "ws-1" } });

    await expect(call("ws-1", file)).resolves.toEqual({ workspace_id: "ws-1" });

    const request = lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/ws-1/${path}`);
    expect(request.init.method).toBe("POST");
    // No Content-Type: the browser must add the multipart boundary itself.
    expect(request.init.headers).toEqual({});
    const body = request.init.body;
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("file")).toBe(file);
  });
});

describe("matching endpoints", () => {
  it("starts a matching run", async () => {
    const response = {
      run_id: "run-1",
      scope: "all_ready_segments",
      status: "pending",
      message: "queued",
      segments_matched: 2,
    };
    respond({ json: response });

    await expect(runMatching("ws-1", { segment_key: null, scope: "all_ready_segments" })).resolves.toEqual(
      response,
    );

    const request = lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/ws-1/matching/runs`);
    expect(request.init.method).toBe("POST");
    expect(bodyJson(request.init)).toEqual({ segment_key: null, scope: "all_ready_segments" });
  });

  it("lists matching runs", async () => {
    const runs = { runs: [{ run_id: "run-1", status: "completed" }] };
    respond({ json: runs });

    await expect(getMatchingRuns("ws-1")).resolves.toEqual(runs);
    expect(lastRequest().url).toBe(`${BASE_URL}/api/workspaces/ws-1/matching/runs`);
  });

  it("reads rooms and students for one segment, encoding the segment key", async () => {
    const rooms = { run_id: "run-1", segment_key: "F 1/3", rooms: [] };
    respond({ json: rooms });
    await expect(getRunRooms("ws-1", "run/1", "F 1/3")).resolves.toEqual(rooms);
    expect(lastRequest().url).toBe(
      `${BASE_URL}/api/workspaces/ws-1/matching/runs/run%2F1/rooms?segment_key=F%201%2F3`,
    );

    const students = { run_id: "run-1", segment_key: "F 1/3", students: [] };
    respond({ json: students });
    await expect(getRunStudents("ws-1", "run/1", "F 1/3")).resolves.toEqual(students);
    expect(lastRequest().url).toBe(
      `${BASE_URL}/api/workspaces/ws-1/matching/runs/run%2F1/students?segment_key=F%201%2F3`,
    );
  });

  it("reads students across every segment of a run", async () => {
    const all = { segments: [{ segment_key: "F_1st", students: [] }] };
    respond({ json: all });

    await expect(getRunStudentsAllSegments("ws-1", "run-1")).resolves.toEqual(all);
    expect(lastRequest().url).toBe(
      `${BASE_URL}/api/workspaces/ws-1/matching/runs/run-1/students/all-segments`,
    );
  });

  it("reads the fairness report", async () => {
    const report = { run_id: "run-1", total_students: 3, by_segment: [] };
    respond({ json: report });

    await expect(getFairnessReport("ws-1", "run-1")).resolves.toEqual(report);
    expect(lastRequest().url).toBe(`${BASE_URL}/api/workspaces/ws-1/fairness/run-1`);
  });

  it("reads the students of a segment", async () => {
    const students = { segment_key: "M_1st_AC_2", room_size: 2, students: [] };
    respond({ json: students });

    await expect(getSegmentStudents("ws-1", "M_1st_AC_2")).resolves.toEqual(students);
    expect(lastRequest().url).toBe(
      `${BASE_URL}/api/workspaces/ws-1/segments/M_1st_AC_2/students`,
    );
  });

  it("runs the manual checker with a JSON body", async () => {
    const response = { group_score: 0.8, group_label: "Good", at_risk_students: [], students: [] };
    respond({ json: response });

    const checkerPayload = {
      segment_key: "M_1st_AC_2",
      room_size: 2,
      student_ids: ["ADM-1", "ADM-2"],
    };
    await expect(runCheckerCompatibility("ws-1", checkerPayload)).resolves.toEqual(response);

    const request = lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/ws-1/checker/compatibility`);
    expect(request.init.method).toBe("POST");
    expect(bodyJson(request.init)).toEqual(checkerPayload);
  });
});

describe("assignments CSV export", () => {
  const csv = new Blob(["room_id,student\nR1,ADM-1"], { type: "text/csv" });

  it("downloads the whole run with the server's filename and content type", async () => {
    setApiToken("export-token");
    respond({
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="all_rooms.csv"',
      },
      blob: csv,
    });

    const result = await exportAssignmentsCsv("ws-1", "run-1");

    const request = lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/ws-1/exports/assignments/run-1`);
    expect(request.init).toEqual({ headers: { Authorization: "Bearer export-token" } });
    expect(result.blob).toBe(csv);
    expect(result.contentType).toBe("text/csv; charset=utf-8");
    expect(result.fileName).toBe("all_rooms.csv");
  });

  it("adds the segment query and an unquoted filename still parses", async () => {
    respond({
      headers: {
        "content-disposition": "attachment; filename=segment_rooms.csv",
        "content-type": "text/csv",
      },
      blob: csv,
    });

    const result = await exportAssignmentsCsv("ws-1", "run-1", "SEG A");

    expect(lastRequest().url).toBe(
      `${BASE_URL}/api/workspaces/ws-1/exports/assignments/run-1?segment_key=SEG%20A`,
    );
    expect(lastRequest().init.headers).toEqual({});
    expect(result.fileName).toBe("segment_rooms.csv");
  });

  it("falls back to a composed filename and text/csv when headers are absent", async () => {
    respond({ blob: csv });

    const wholeRun = await exportAssignmentsCsv("ws-1", "run-1");
    expect(wholeRun.fileName).toBe("assignments_run-1.csv");
    expect(wholeRun.contentType).toBe("text/csv");

    respond({ blob: csv });
    const segment = await exportAssignmentsCsv("ws-1", "run-1", "SEG_A");
    expect(segment.fileName).toBe("assignments_run-1_SEG_A.csv");
  });

  it("falls back when content-disposition carries no filename", async () => {
    respond({ headers: { "content-disposition": "attachment" }, blob: csv });

    const result = await exportAssignmentsCsv("ws-1", "run-1");

    expect(result.fileName).toBe("assignments_run-1.csv");
  });

  it("throws the error envelope instead of downloading a failed export", async () => {
    respond({ status: 500, json: { detail: "Export failed. Try again." } });

    await expect(exportAssignmentsCsv("ws-1", "run-1")).rejects.toThrow(
      "Export failed. Try again.",
    );
  });

  it("uses the generic message when the failed export body is not JSON", async () => {
    respond({ status: 500, invalidJson: true });

    await expect(exportAssignmentsCsv("ws-1", "run-1")).rejects.toThrow(
      "Request failed. Please try again.",
    );
  });
});

describe("magic fill", () => {
  const filled = {
    workspace_id: "ws-1",
    segment_key: "SEG_A",
    profiles_created: 4,
    students_skipped: 1,
  };

  it("targets one segment when a segment key is given", async () => {
    setApiToken("magic-token");
    respond({ json: filled });

    await expect(magicFillWorkspace("ws-1", "SEG_A")).resolves.toEqual(filled);

    const request = lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/ws-1/magic-fill`);
    expect(request.init.method).toBe("POST");
    expect(request.init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer magic-token",
    });
    expect(bodyJson(request.init)).toEqual({ segment_key: "SEG_A" });
  });

  it("sends an empty body for the whole workspace and no auth header without a token", async () => {
    respond({ json: { ...filled, segment_key: null } });

    await magicFillWorkspace("ws-1");

    expect(lastRequest().init.headers).toEqual({ "Content-Type": "application/json" });
    expect(bodyJson(lastRequest().init)).toEqual({});
  });

  it("surfaces the API detail when magic fill is refused", async () => {
    respond({ status: 409, json: { detail: "Nothing to fill" } });

    await expect(magicFillWorkspace("ws-1")).rejects.toThrow("Nothing to fill");
  });

  it("falls back to a readable message when the refusal body is not JSON", async () => {
    respond({ status: 500, invalidJson: true });

    await expect(magicFillWorkspace("ws-1")).rejects.toThrow("Magic Fill failed.");
  });
});

describe("platform endpoints", () => {
  it("lists tenants without demo data by default and with it on request", async () => {
    respond({ json: { tenants: [], total: 0 } });
    await expect(getPlatformTenants()).resolves.toEqual({ tenants: [], total: 0 });
    expect(lastRequest().url).toBe(`${BASE_URL}/api/platform/tenants`);

    respond({ json: { tenants: [{ id: "t-1" }], total: 1 } });
    await expect(getPlatformTenants(true)).resolves.toEqual({ tenants: [{ id: "t-1" }], total: 1 });
    expect(lastRequest().url).toBe(`${BASE_URL}/api/platform/tenants?include_demo=true`);
  });

  it("reads one tenant and its workspaces, encoding the tenant id", async () => {
    const tenant = { id: "t/1", slug: "demo", display_name: "Demo" };
    respond({ json: tenant });
    await expect(getPlatformTenant("t/1")).resolves.toEqual(tenant);
    expect(lastRequest().url).toBe(`${BASE_URL}/api/platform/tenants/t%2F1`);

    const workspaces = { tenant_id: "t/1", workspaces: [] };
    respond({ json: workspaces });
    await expect(getPlatformTenantWorkspaces("t/1")).resolves.toEqual(workspaces);
    expect(lastRequest().url).toBe(`${BASE_URL}/api/platform/tenants/t%2F1/workspaces`);
  });

  it("impersonates a workspace with the workspace id in the body", async () => {
    const impersonation = {
      token: "jwt",
      tenant_id: "t-1",
      workspace_id: "ws-1",
      expires_in_hours: 2,
    };
    respond({ json: impersonation });

    await expect(impersonateTenant("t-1", "ws-1")).resolves.toEqual(impersonation);

    const request = lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/platform/tenants/t-1/impersonate`);
    expect(request.init.method).toBe("POST");
    expect(request.init.headers).toEqual({ "Content-Type": "application/json" });
    expect(bodyJson(request.init)).toEqual({ workspace_id: "ws-1" });
  });
});
