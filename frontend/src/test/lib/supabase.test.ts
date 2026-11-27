// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * supabase.ts loads the browser client lazily, from `import.meta.env`.
 * These tests exercise that wiring without touching auth or the network:
 * `createClient` only builds the client object; `auth.*` is never called.
 */
describe("supabase client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("creates a configured client from the environment", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");

    const { isSupabaseConfigured, getSupabase } = await import("../../lib/supabase");
    const supabase = await getSupabase();

    expect(isSupabaseConfigured).toBe(true);
    expect(typeof supabase.auth.getSession).toBe("function");
    expect(typeof supabase.from).toBe("function");
  });

  it("keeps the app importable and logs an error when the URL is missing", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { isSupabaseConfigured, getSupabase } = await import("../../lib/supabase");

    expect(isSupabaseConfigured).toBe(false);
    expect(await getSupabase()).toBeDefined();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("Missing VITE_SUPABASE_URL"));
  });

  it("keeps the app importable when only the anon key is missing", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { isSupabaseConfigured } = await import("../../lib/supabase");

    expect(isSupabaseConfigured).toBe(false);
  });

  it("returns the same client on repeated calls", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");

    const { getSupabase } = await import("../../lib/supabase");

    expect(await getSupabase()).toBe(await getSupabase());
  });
});

describe("hasSupabaseSessionHint", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("detects an access_token in the hash", async () => {
    vi.stubGlobal("location", { hash: "#access_token=abc" });
    const { hasSupabaseSessionHint } = await import("../../lib/supabase");

    expect(hasSupabaseSessionHint()).toBe(true);
  });

  it("detects an sb- auth-token localStorage key", async () => {
    vi.stubGlobal("location", { hash: "" });
    vi.stubGlobal("localStorage", { "sb-project-auth-token": "{}" });
    const { hasSupabaseSessionHint } = await import("../../lib/supabase");

    expect(hasSupabaseSessionHint()).toBe(true);
  });

  it("returns false when no session hint exists", async () => {
    vi.stubGlobal("location", { hash: "" });
    vi.stubGlobal("localStorage", { "other-key": "value" });
    const { hasSupabaseSessionHint } = await import("../../lib/supabase");

    expect(hasSupabaseSessionHint()).toBe(false);
  });

  it("returns false when storage access throws", async () => {
    vi.stubGlobal("location", { hash: "" });
    vi.stubGlobal(
      "localStorage",
      new Proxy(
        {},
        {
          ownKeys() {
            throw new Error("storage blocked");
          },
        },
      ),
    );
    const { hasSupabaseSessionHint } = await import("../../lib/supabase");

    expect(hasSupabaseSessionHint()).toBe(false);
  });
});
