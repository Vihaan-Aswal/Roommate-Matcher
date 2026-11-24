import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { adminQueryKeys } from "../../hooks/adminQueryKeys";
import {
  useAdminFormStatusQuery,
  useAdminNonSubmittersQuery,
  useRegenerateFormLinkMutation,
  useWorkspaceFormLinkQuery,
} from "../../hooks/useAdminFormCollection";
import { useAdminMatchingRunsQuery, useRunMatchingMutation } from "../../hooks/useAdminMatchingRuns";
import { useAdminSegmentsQuery } from "../../hooks/useAdminSegments";
import {
  useApplyRoomUploadMutation,
  useApplyStudentUploadMutation,
  usePreviewRoomUploadMutation,
  usePreviewStudentUploadMutation,
} from "../../hooks/useAdminUploads";
import { useAssignmentsExportMutation } from "../../hooks/useAssignmentsExportMutation";
import { useFormSubmit } from "../../hooks/useFormSubmit";
import { useManualCheckerMutation } from "../../hooks/useManualCheckerMutation";
import { useRunFairnessQuery } from "../../hooks/useRunFairnessQuery";
import { useRunRoomsQuery } from "../../hooks/useRunRoomsQuery";
import { useRunStudentsAllSegmentsQuery } from "../../hooks/useRunStudentsAllSegmentsQuery";
import { useRunStudentsQuery } from "../../hooks/useRunStudentsQuery";
import { useSegmentStudentsQuery } from "../../hooks/useSegmentStudentsQuery";
import {
  useCreateWorkspaceMutation,
  useWorkspaceDashboardQuery,
  useWorkspacesQuery,
} from "../../hooks/useWorkspacesQuery";

const api = vi.hoisted(() => ({
  getFormStatus: vi.fn(),
  getNonSubmitters: vi.fn(),
  getWorkspaceFormLink: vi.fn(),
  regenerateWorkspaceFormLink: vi.fn(),
  getMatchingRuns: vi.fn(),
  runMatching: vi.fn(),
  getSegments: vi.fn(),
  previewStudentUpload: vi.fn(),
  applyStudentUpload: vi.fn(),
  previewRoomUpload: vi.fn(),
  applyRoomUpload: vi.fn(),
  exportAssignmentsCsv: vi.fn(),
  submitPublicForm: vi.fn(),
  runCheckerCompatibility: vi.fn(),
  getFairnessReport: vi.fn(),
  getRunRooms: vi.fn(),
  getRunStudentsAllSegments: vi.fn(),
  getRunStudents: vi.fn(),
  getSegmentStudents: vi.fn(),
  getWorkspaces: vi.fn(),
  getWorkspaceDashboard: vi.fn(),
  createWorkspace: vi.fn(),
}));

vi.mock("../../lib/apiClient", () => api);

interface Rendered {
  client: QueryClient;
  invalidate: MockInstance;
  wrapper: (props: { children: ReactNode }) => ReactNode;
}

function setup(): Rendered {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  return {
    client,
    invalidate,
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}

function invalidatedKeys(invalidate: Rendered["invalidate"]): unknown[] {
  return invalidate.mock.calls.map(
    ([arg]) => (arg as unknown as { queryKey: unknown }).queryKey,
  );
}

async function settle<T>(hook: { result: { current: T } }, predicate: (value: T) => boolean) {
  await waitFor(() => expect(predicate(hook.result.current)).toBe(true));
}

beforeEach(() => {
  for (const fn of Object.values(api)) {
    fn.mockReset();
  }
});

describe("admin query keys", () => {
  it("builds every workspace-scoped key from the workspace id", () => {
    expect(adminQueryKeys.workspaceDashboard("ws")).toEqual(["workspace", "ws", "dashboard"]);
    expect(adminQueryKeys.workspaceDetail("ws")).toEqual(["workspace", "ws"]);
    expect(adminQueryKeys.dashboard("ws")).toEqual(["workspace", "ws", "dashboard-legacy"]);
    expect(adminQueryKeys.segments("ws")).toEqual(["workspace", "ws", "segments"]);
    expect(adminQueryKeys.formStatus("ws")).toEqual(["workspace", "ws", "form-status"]);
    expect(adminQueryKeys.nonSubmitters("ws")).toEqual(["workspace", "ws", "form-non-submitters"]);
    expect(adminQueryKeys.matchingRuns("ws")).toEqual(["workspace", "ws", "matching-runs"]);
    expect(adminQueryKeys.segmentStudents("ws", "SEG")).toEqual([
      "workspace",
      "ws",
      "segment-students",
      "SEG",
    ]);
    expect(adminQueryKeys.checkerCompatibility("ws", "SEG", ["a", "b"])).toEqual([
      "workspace",
      "ws",
      "checker",
      "SEG",
      "a",
      "b",
    ]);
    expect(adminQueryKeys.runStudentsAllSegments("ws", "run")).toEqual([
      "workspace",
      "ws",
      "matching-students-all",
      "run",
    ]);
    expect(adminQueryKeys.workspaces).toEqual(["workspaces"]);
  });

  it("builds platform keys and defaults includeDemo to false", () => {
    expect(adminQueryKeys.platformTenants()).toEqual([
      "platform",
      "tenants",
      { includeDemo: false },
    ]);
    expect(adminQueryKeys.platformTenants(true)).toEqual([
      "platform",
      "tenants",
      { includeDemo: true },
    ]);
    expect(adminQueryKeys.platformTenant("t-1")).toEqual(["platform", "tenant", "t-1"]);
    expect(adminQueryKeys.platformTenantWorkspaces("t-1")).toEqual([
      "platform",
      "tenant",
      "t-1",
      "workspaces",
    ]);
  });
});

describe("useAdminFormStatusQuery / useAdminNonSubmittersQuery / useWorkspaceFormLinkQuery", () => {
  it("stays idle until a workspace is selected", () => {
    const { wrapper } = setup();

    const status = renderHook(() => useAdminFormStatusQuery(null), { wrapper });
    const nonSubmitters = renderHook(() => useAdminNonSubmittersQuery(null), { wrapper });
    const link = renderHook(() => useWorkspaceFormLinkQuery(null), { wrapper });

    expect(status.result.current.fetchStatus).toBe("idle");
    expect(status.result.current.data).toBeUndefined();
    expect(nonSubmitters.result.current.fetchStatus).toBe("idle");
    expect(link.result.current.fetchStatus).toBe("idle");
    expect(api.getFormStatus).not.toHaveBeenCalled();
    expect(api.getNonSubmitters).not.toHaveBeenCalled();
    expect(api.getWorkspaceFormLink).not.toHaveBeenCalled();
  });

  it("fetches collection status, non-submitters and the form link under their keys", async () => {
    const statusPayload = {
      total_students: 4,
      valid_responses: 3,
      invalid_responses: 0,
      percentage_valid: 75,
      by_segment: [],
    };
    const nonSubmitterPayload = {
      non_submitters: [{ admission_number: "ADM-4", full_name: "D", segment_key: "SEG" }],
      total_count: 1,
    };
    const linkPayload = { token: "tok-1", expires_at: "2030-01-01T00:00:00Z" };
    api.getFormStatus.mockResolvedValue(statusPayload);
    api.getNonSubmitters.mockResolvedValue(nonSubmitterPayload);
    api.getWorkspaceFormLink.mockResolvedValue(linkPayload);

    const { client, wrapper } = setup();
    const status = renderHook(() => useAdminFormStatusQuery("ws-1"), { wrapper });
    const nonSubmitters = renderHook(() => useAdminNonSubmittersQuery("ws-1"), { wrapper });
    const link = renderHook(() => useWorkspaceFormLinkQuery("ws-1"), { wrapper });

    await settle(status, (hook) => hook.isSuccess);
    await settle(nonSubmitters, (hook) => hook.isSuccess);
    await settle(link, (hook) => hook.isSuccess);

    expect(api.getFormStatus).toHaveBeenCalledWith("ws-1");
    expect(api.getNonSubmitters).toHaveBeenCalledWith("ws-1");
    expect(api.getWorkspaceFormLink).toHaveBeenCalledWith("ws-1");
    expect(status.result.current.data).toEqual(statusPayload);
    expect(nonSubmitters.result.current.data).toEqual(nonSubmitterPayload);
    expect(link.result.current.data).toEqual(linkPayload);
    expect(client.getQueryData(adminQueryKeys.formStatus("ws-1"))).toEqual(statusPayload);
    expect(client.getQueryData(adminQueryKeys.nonSubmitters("ws-1"))).toEqual(nonSubmitterPayload);
    expect(client.getQueryData(["workspace", "ws-1", "form-link"])).toEqual(linkPayload);
  });
});

describe("useRegenerateFormLinkMutation", () => {
  it("regenerates the link and invalidates only the form-link key", async () => {
    api.regenerateWorkspaceFormLink.mockResolvedValue({ token: "tok-2" });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useRegenerateFormLinkMutation("ws-1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(api.regenerateWorkspaceFormLink).toHaveBeenCalledWith("ws-1");
    await waitFor(() => expect(result.current.data).toEqual({ token: "tok-2" }));
    expect(invalidatedKeys(invalidate)).toEqual([["workspace", "ws-1", "form-link"]]);
  });
});

describe("useAdminMatchingRunsQuery / useRunMatchingMutation", () => {
  it("lists runs for the workspace", async () => {
    const payload = { runs: [{ run_id: "run-1", status: "completed" }] };
    api.getMatchingRuns.mockResolvedValue(payload);
    const { client, wrapper } = setup();
    const hook = renderHook(() => useAdminMatchingRunsQuery("ws-1"), { wrapper });

    await settle(hook, (value) => value.isSuccess);

    expect(api.getMatchingRuns).toHaveBeenCalledWith("ws-1");
    expect(client.getQueryData(adminQueryKeys.matchingRuns("ws-1"))).toEqual(payload);
  });

  it("invalidates runs, dashboard and segments after a matching run", async () => {
    const request = { segment_key: "SEG_A", scope: "segment" as const };
    api.runMatching.mockResolvedValue({ run_id: "run-2", status: "pending" });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useRunMatchingMutation("ws-1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(request);
    });

    expect(api.runMatching).toHaveBeenCalledWith("ws-1", request);
    await waitFor(() => expect(result.current.data).toEqual({ run_id: "run-2", status: "pending" }));
    expect(invalidatedKeys(invalidate)).toEqual([
      adminQueryKeys.matchingRuns("ws-1"),
      adminQueryKeys.dashboard("ws-1"),
      adminQueryKeys.segments("ws-1"),
    ]);
  });
});

describe("useAdminSegmentsQuery", () => {
  it("does not fetch without a workspace and parks the query under the empty key", () => {
    const { client, wrapper } = setup();
    const hook = renderHook(() => useAdminSegmentsQuery(null), { wrapper });

    expect(api.getSegments).not.toHaveBeenCalled();
    expect(hook.result.current.fetchStatus).toBe("idle");
    expect(client.getQueryCache().find({ queryKey: ["workspace", "none", "segments"] })).toBeDefined();
  });

  it("fetches the segments for a selected workspace", async () => {
    const payload = { segments: [{ segment_key: "SEG_A", status: "ready" }] };
    api.getSegments.mockResolvedValue(payload);
    const { client, wrapper } = setup();
    const hook = renderHook(() => useAdminSegmentsQuery("ws-1"), { wrapper });

    await settle(hook, (value) => value.isSuccess);

    expect(api.getSegments).toHaveBeenCalledWith("ws-1");
    expect(client.getQueryData(adminQueryKeys.segments("ws-1"))).toEqual(payload);
  });
});

describe("upload mutations", () => {
  const file = new File(["csv"], "data.csv", { type: "text/csv" });

  it("previews a student upload without touching cached data", async () => {
    api.previewStudentUpload.mockResolvedValue({ workspace_id: "ws-1", total_csv_rows: 3 });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => usePreviewStudentUploadMutation("ws-1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(file);
    });

    expect(api.previewStudentUpload).toHaveBeenCalledWith("ws-1", file);
    await waitFor(() =>
      expect(result.current.data).toEqual({ workspace_id: "ws-1", total_csv_rows: 3 }),
    );
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("previews a room upload without touching cached data", async () => {
    api.previewRoomUpload.mockResolvedValue({ workspace_id: "ws-1", total_csv_rows: 2 });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => usePreviewRoomUploadMutation("ws-1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(file);
    });

    expect(api.previewRoomUpload).toHaveBeenCalledWith("ws-1", file);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("applies a student upload and refreshes everything the import can change", async () => {
    api.applyStudentUpload.mockResolvedValue({ workspace_id: "ws-1", inserted: 3 });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useApplyStudentUploadMutation("ws-1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ file, confirmRemovals: true });
    });

    expect(api.applyStudentUpload).toHaveBeenCalledWith("ws-1", file, true);
    await waitFor(() =>
      expect(result.current.data).toEqual({ workspace_id: "ws-1", inserted: 3 }),
    );
    expect(invalidatedKeys(invalidate)).toEqual([
      adminQueryKeys.workspaceDashboard("ws-1"),
      adminQueryKeys.segments("ws-1"),
      adminQueryKeys.formStatus("ws-1"),
      adminQueryKeys.nonSubmitters("ws-1"),
    ]);
  });

  it("applies a room upload and refreshes everything the import can change", async () => {
    api.applyRoomUpload.mockResolvedValue({ workspace_id: "ws-1", updated: 2 });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useApplyRoomUploadMutation("ws-1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(file);
    });

    expect(api.applyRoomUpload).toHaveBeenCalledWith("ws-1", file);
    expect(invalidatedKeys(invalidate)).toEqual([
      adminQueryKeys.workspaceDashboard("ws-1"),
      adminQueryKeys.segments("ws-1"),
      adminQueryKeys.formStatus("ws-1"),
      adminQueryKeys.nonSubmitters("ws-1"),
    ]);
  });
});

describe("useAssignmentsExportMutation", () => {
  it("exports a run scoped to a segment", async () => {
    const file = { blob: new Blob(["csv"]), contentType: "text/csv", fileName: "a.csv" };
    api.exportAssignmentsCsv.mockResolvedValue(file);
    const { wrapper } = setup();
    const { result } = renderHook(() => useAssignmentsExportMutation("ws-1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ runId: "run-1", segmentKey: "SEG_A" });
    });

    expect(api.exportAssignmentsCsv).toHaveBeenCalledWith("ws-1", "run-1", "SEG_A");
    await waitFor(() => expect(result.current.data).toEqual(file));
  });

  it("exports the whole run when no segment is given", async () => {
    api.exportAssignmentsCsv.mockResolvedValue({ fileName: "all.csv" });
    const { wrapper } = setup();
    const { result } = renderHook(() => useAssignmentsExportMutation("ws-1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ runId: "run-1" });
    });

    expect(api.exportAssignmentsCsv).toHaveBeenCalledWith("ws-1", "run-1", undefined);
  });
});

describe("useFormSubmit", () => {
  const payload = {
    admission_number: "ADM-1",
    phone_last4: "1234",
    q1_raw: "a",
    q2_raw: "b",
    q3_raw: "c",
    q4a_raw: "d",
    q4b_raw: "e",
    q5a_raw: "f",
    q5b_raw: "g",
    q6_raw: "h",
    q7_raw: "i",
    q8_raw: "j",
    q9_raw: "k",
    q10_raw: "l",
  };

  it("starts non-submitting and returns the accepted result", async () => {
    const accepted = { success: true, message: "Recorded", has_preferences: true };
    api.submitPublicForm.mockResolvedValue(accepted);
    const { wrapper } = setup();
    const hook = renderHook(() => useFormSubmit(), { wrapper });

    expect(hook.result.current.submitting).toBe(false);
    expect(hook.result.current.submitError).toBeNull();

    let returned: unknown;
    await act(async () => {
      returned = await hook.result.current.submit("tok-1", payload);
    });

    expect(returned).toEqual(accepted);
    expect(api.submitPublicForm).toHaveBeenCalledWith("tok-1", payload);
    expect(hook.result.current.submitting).toBe(false);
    expect(hook.result.current.submitError).toBeNull();
  });

  it("holds the submitting flag while the network call is in flight", async () => {
    let release: (value: unknown) => void = () => {};
    api.submitPublicForm.mockImplementation(
      () => new Promise((resolve) => {
        release = resolve;
      }),
    );
    const { wrapper } = setup();
    const hook = renderHook(() => useFormSubmit(), { wrapper });

    let pending!: Promise<unknown>;
    act(() => {
      pending = hook.result.current.submit("tok-1", payload);
    });
    expect(hook.result.current.submitting).toBe(true);

    await act(async () => {
      release({ success: true, message: "ok" });
      await pending;
    });

    expect(hook.result.current.submitting).toBe(false);
  });

  it("records the error message and rethrows so the caller can react", async () => {
    api.submitPublicForm.mockRejectedValue(new Error("Network down"));
    const { wrapper } = setup();
    const hook = renderHook(() => useFormSubmit(), { wrapper });

    await act(async () => {
      await expect(hook.result.current.submit("tok-1", payload)).rejects.toThrow("Network down");
    });

    expect(hook.result.current.submitError).toBe("Network down");
    expect(hook.result.current.submitting).toBe(false);
  });

  it("uses a readable fallback for a non-Error rejection", async () => {
    api.submitPublicForm.mockRejectedValue("offline");
    const { wrapper } = setup();
    const hook = renderHook(() => useFormSubmit(), { wrapper });

    await act(async () => {
      await expect(hook.result.current.submit("tok-1", payload)).rejects.toBe("offline");
    });

    expect(hook.result.current.submitError).toBe("Failed to submit.");
  });
});

describe("useManualCheckerMutation", () => {
  it("runs the checker for the selected students", async () => {
    const response = { group_score: 0.9, group_label: "Excellent", at_risk_students: [], students: [] };
    api.runCheckerCompatibility.mockResolvedValue(response);
    const { wrapper } = setup();
    const { result } = renderHook(() => useManualCheckerMutation("ws-1"), { wrapper });

    const payload = { segment_key: "SEG_A", room_size: 3, student_ids: ["ADM-1", "ADM-2"] };
    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(api.runCheckerCompatibility).toHaveBeenCalledWith("ws-1", payload);
    await waitFor(() => expect(result.current.data).toEqual(response));
  });
});

describe("useRunFairnessQuery", () => {
  it("does not fetch until a run is selected", () => {
    const { wrapper } = setup();
    const hook = renderHook(() => useRunFairnessQuery("ws-1", null), { wrapper });

    expect(api.getFairnessReport).not.toHaveBeenCalled();
    expect(hook.result.current.fetchStatus).toBe("idle");
  });

  it("fetches the fairness report under the run key", async () => {
    const report = { run_id: "run-1", total_students: 4, by_segment: [] };
    api.getFairnessReport.mockResolvedValue(report);
    const { client, wrapper } = setup();
    const hook = renderHook(() => useRunFairnessQuery("ws-1", "run-1"), { wrapper });

    await settle(hook, (value) => value.isSuccess);

    expect(api.getFairnessReport).toHaveBeenCalledWith("ws-1", "run-1");
    expect(client.getQueryData(adminQueryKeys.fairnessByRun("ws-1", "run-1"))).toEqual(report);
  });
});

describe("useRunRoomsQuery", () => {
  it("does not fetch without a segment", () => {
    const { wrapper } = setup();
    const hook = renderHook(() => useRunRoomsQuery("ws-1", "run-1", null), { wrapper });

    expect(api.getRunRooms).not.toHaveBeenCalled();
    expect(hook.result.current.fetchStatus).toBe("idle");
  });

  it("fetches rooms for the run and segment", async () => {
    const rooms = { run_id: "run-1", segment_key: "SEG_A", rooms: [] };
    api.getRunRooms.mockResolvedValue(rooms);
    const { client, wrapper } = setup();
    const hook = renderHook(() => useRunRoomsQuery("ws-1", "run-1", "SEG_A"), { wrapper });

    await settle(hook, (value) => value.isSuccess);

    expect(api.getRunRooms).toHaveBeenCalledWith("ws-1", "run-1", "SEG_A");
    expect(client.getQueryData(adminQueryKeys.roomsByRunSegment("ws-1", "run-1", "SEG_A"))).toEqual(
      rooms,
    );
  });
});

describe("useRunStudentsQuery", () => {
  it("does not fetch without a segment", () => {
    const { wrapper } = setup();
    const hook = renderHook(() => useRunStudentsQuery("ws-1", "run-1", null), { wrapper });

    expect(api.getRunStudents).not.toHaveBeenCalled();
    expect(hook.result.current.fetchStatus).toBe("idle");
  });

  it("fetches students for the run and segment", async () => {
    const students = { run_id: "run-1", segment_key: "SEG_A", students: [] };
    api.getRunStudents.mockResolvedValue(students);
    const { client, wrapper } = setup();
    const hook = renderHook(() => useRunStudentsQuery("ws-1", "run-1", "SEG_A"), { wrapper });

    await settle(hook, (value) => value.isSuccess);

    expect(api.getRunStudents).toHaveBeenCalledWith("ws-1", "run-1", "SEG_A");
    expect(
      client.getQueryData(adminQueryKeys.studentsByRunSegment("ws-1", "run-1", "SEG_A")),
    ).toEqual(students);
  });
});

describe("useSegmentStudentsQuery", () => {
  it("does not fetch without a segment", () => {
    const { wrapper } = setup();
    const hook = renderHook(() => useSegmentStudentsQuery("ws-1", null), { wrapper });

    expect(api.getSegmentStudents).not.toHaveBeenCalled();
    expect(hook.result.current.fetchStatus).toBe("idle");
  });

  it("fetches the segment roster", async () => {
    const students = { segment_key: "SEG_A", room_size: 3, students: [] };
    api.getSegmentStudents.mockResolvedValue(students);
    const { client, wrapper } = setup();
    const hook = renderHook(() => useSegmentStudentsQuery("ws-1", "SEG_A"), { wrapper });

    await settle(hook, (value) => value.isSuccess);

    expect(api.getSegmentStudents).toHaveBeenCalledWith("ws-1", "SEG_A");
    expect(client.getQueryData(adminQueryKeys.segmentStudents("ws-1", "SEG_A"))).toEqual(students);
  });
});

describe("useRunStudentsAllSegmentsQuery", () => {
  it("does not fetch when the caller disables it", () => {
    const { wrapper } = setup();
    const hook = renderHook(() => useRunStudentsAllSegmentsQuery("ws-1", "run-1", false), {
      wrapper,
    });

    expect(api.getRunStudentsAllSegments).not.toHaveBeenCalled();
    expect(hook.result.current.students).toEqual([]);
    expect(hook.result.current.isLoading).toBe(false);
  });

  it("flattens the segments and sorts students by admission number", async () => {
    api.getRunStudentsAllSegments.mockResolvedValue({
      segments: [
        { segment_key: "SEG_B", students: [{ admission_number: "B-2" }, { admission_number: "A-1" }] },
        { segment_key: "SEG_C", students: [{ admission_number: "C-3" }] },
      ],
    });
    const { wrapper } = setup();
    const hook = renderHook(() => useRunStudentsAllSegmentsQuery("ws-1", "run-1", true), {
      wrapper,
    });

    await settle(hook, (value) => !value.isLoading && value.students.length === 3);

    expect(api.getRunStudentsAllSegments).toHaveBeenCalledWith("ws-1", "run-1");
    expect(hook.result.current.students.map((student) => student.admission_number)).toEqual([
      "A-1",
      "B-2",
      "C-3",
    ]);
    expect(hook.result.current.isError).toBe(false);
    expect(hook.result.current.error).toBeNull();
  });

  it("returns an empty list when the run has no segments", async () => {
    api.getRunStudentsAllSegments.mockResolvedValue({ segments: [] });
    const { wrapper } = setup();
    const hook = renderHook(() => useRunStudentsAllSegmentsQuery("ws-1", "run-1", true), {
      wrapper,
    });

    await settle(hook, (value) => value.isLoading === false);

    expect(hook.result.current.students).toEqual([]);
  });

  it("exposes an Error and refetches on demand", async () => {
    api.getRunStudentsAllSegments
      .mockRejectedValueOnce(new Error("students failed"))
      .mockResolvedValueOnce({ segments: [] });
    const { wrapper } = setup();
    const hook = renderHook(() => useRunStudentsAllSegmentsQuery("ws-1", "run-1", true), {
      wrapper,
    });

    await settle(hook, (value) => value.isError);

    expect(hook.result.current.error).toBeInstanceOf(Error);
    expect(hook.result.current.error?.message).toBe("students failed");

    await act(async () => {
      await hook.result.current.refetchAll();
    });

    expect(api.getRunStudentsAllSegments).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(hook.result.current.isError).toBe(false));
  });

  it("reports no error object for a non-Error rejection", async () => {
    api.getRunStudentsAllSegments.mockRejectedValueOnce("offline");
    const { wrapper } = setup();
    const hook = renderHook(() => useRunStudentsAllSegmentsQuery("ws-1", "run-1", true), {
      wrapper,
    });

    await settle(hook, (value) => value.isError);

    expect(hook.result.current.error).toBeNull();
  });
});

describe("workspace hooks", () => {
  it("lists workspaces from the shared key", async () => {
    const payload = { workspaces: [{ id: "ws-1", name: "Main" }] };
    api.getWorkspaces.mockResolvedValue(payload);
    const { client, wrapper } = setup();
    const hook = renderHook(() => useWorkspacesQuery(), { wrapper });

    await settle(hook, (value) => value.isSuccess);

    expect(api.getWorkspaces).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(adminQueryKeys.workspaces)).toEqual(payload);
  });

  it("does not fetch a dashboard without a workspace id", () => {
    const { wrapper } = setup();
    const hook = renderHook(() => useWorkspaceDashboardQuery(""), { wrapper });

    expect(api.getWorkspaceDashboard).not.toHaveBeenCalled();
    expect(hook.result.current.fetchStatus).toBe("idle");
  });

  it("fetches a dashboard and maps the setup state", async () => {
    const payload = {
      workspace: { id: "ws-1", name: "Main" },
      setup_status: {
        master_students_uploaded: true,
        rooms_uploaded: true,
        forms_collection_started: false,
        at_least_one_segment_ready: false,
      },
      form_collection_stats: {
        total_students: 10,
        students_with_valid_preferences: 4,
        percentage_complete: 40,
      },
      segments_status: { total_segments: 2, ready: 0, impossible: 0, at_risk: 2 },
      latest_matching_run: { run_id: null, status: null, created_at: null },
    };
    api.getWorkspaceDashboard.mockResolvedValue(payload);
    const { client, wrapper } = setup();
    const hook = renderHook(() => useWorkspaceDashboardQuery("ws-1"), { wrapper });

    await settle(hook, (value) => value.isSuccess);

    expect(api.getWorkspaceDashboard).toHaveBeenCalledWith("ws-1");
    expect(hook.result.current.data?.form_collection_stats.percentage_complete).toBe(40);
    expect(client.getQueryData(adminQueryKeys.workspaceDashboard("ws-1"))).toEqual(payload);
  });

  it("creates a workspace and invalidates the workspace list", async () => {
    const created = { id: "ws-2", name: "Annexe" };
    api.createWorkspace.mockResolvedValue(created);
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useCreateWorkspaceMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: "Annexe" });
    });

    expect(api.createWorkspace).toHaveBeenCalledWith({ name: "Annexe" });
    await waitFor(() => expect(result.current.data).toEqual(created));
    expect(invalidatedKeys(invalidate)).toEqual([adminQueryKeys.workspaces]);
  });
});
