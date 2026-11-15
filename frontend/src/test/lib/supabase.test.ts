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
  });

  it("creates a client from the configured environment", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");

    const { supabase } = await import("../../lib/supabase");

    expect(supabase).toBeDefined();
    expect(typeof supabase.auth.getSession).toBe("function");
    expect(typeof supabase.from).toBe("function");
  });

  it("fails loudly, naming both variables, when the URL is missing", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");

    await expect(import("../../lib/supabase")).rejects.toThrow(
      /Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY/,
    );
  });

  it("fails loudly when only the anon key is missing", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

    await expect(import("../../lib/supabase")).rejects.toThrow(
      /Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY/,
    );
  });
});
