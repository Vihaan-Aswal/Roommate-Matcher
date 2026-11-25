import { afterEach, describe, expect, it, vi } from "vitest";

// warmBackend keeps its in-flight promise at module scope, so each test gets a
// fresh module rather than inheriting the previous test's request.
async function loadWarmBackend() {
  vi.resetModules();
  return (await import("../../lib/apiClient")).warmBackend;
}

describe("warmBackend", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pings the liveness endpoint once while a warm-up is in flight", async () => {
    const warmBackend = await loadWarmBackend();
    let resolveFetch!: (response: { ok: boolean }) => void;
    const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<unknown>>(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = warmBackend();
    const second = warmBackend();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/health\/live$/);

    resolveFetch({ ok: true });
    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
  });

  it("swallows failures and lets a later call retry", async () => {
    const warmBackend = await loadWarmBackend();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(warmBackend()).resolves.toBeUndefined();
    await expect(warmBackend()).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
