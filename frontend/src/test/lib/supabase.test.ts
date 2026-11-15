// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * supabase.ts instantiates the browser client once, from `import.meta.env`.
 * These tests exercise that wiring without touching auth or the network:
 * `createClient` only builds the client object; `auth.*` is never called.
 */
describe("supabase client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("creates a configured client from the environment", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");

    const { isSupabaseConfigured, supabase } = await import("../../lib/supabase");

    expect(isSupabaseConfigured).toBe(true);
    expect(typeof supabase.auth.getSession).toBe("function");
    expect(typeof supabase.from).toBe("function");
  });

  it("keeps the app importable and logs an error when the URL is missing", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { isSupabaseConfigured, supabase } = await import("../../lib/supabase");

    expect(isSupabaseConfigured).toBe(false);
    expect(supabase).toBeDefined();
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
});
