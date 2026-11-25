import { afterEach, describe, expect, it, vi } from "vitest";

// warmBackend keeps its in-flight promise at module scope, so each test gets a
// fresh module rather than inheriting the previous test's request.
async function loadWarmBackend() {
  vi.resetModules();
  return (await import("../../lib/apiClient")).warmBackend;
}

function fakeResponse(ok: boolean): Response {
  return { ok } as Response;
}

describe("warmBackend", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("pings a cache-busted liveness URL with no-store while a warm-up is in flight", async () => {
    const warmBackend = await loadWarmBackend();
    let resolveFetch!: (value: Response) => void;
    const fetchMock =
      vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const first = warmBackend();
    const second = warmBackend();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/health\/live\?warm=\d+$/);
    expect(init?.cache).toBe("no-store");
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    resolveFetch(fakeResponse(true));
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
  });

  it("uses a fresh cache-busting URL for a later call", async () => {
    const warmBackend = await loadWarmBackend();
    const now = vi.spyOn(Date, "now").mockReturnValue(111);
    const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(
      () => Promise.resolve(fakeResponse(true)),
    );
    vi.stubGlobal("fetch", fetchMock);

    await warmBackend();
    now.mockReturnValue(222);
    await warmBackend();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).not.toBe(
      String(fetchMock.mock.calls[1][0]),
    );
  });

  it("reports a non-ok liveness response as not warm", async () => {
    const warmBackend = await loadWarmBackend();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(fakeResponse(false))));

    await expect(warmBackend()).resolves.toBe(false);
  });

  it("swallows failures, reports not warm, and lets a later call retry", async () => {
    const warmBackend = await loadWarmBackend();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(fakeResponse(true));
    vi.stubGlobal("fetch", fetchMock);

    await expect(warmBackend()).resolves.toBe(false);
    await expect(warmBackend()).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
