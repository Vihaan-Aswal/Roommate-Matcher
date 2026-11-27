/**
 * supabase.ts — lazily created Supabase browser client.
 *
 * The SDK is large and anonymous demo visitors never need it, so it is loaded
 * only when `getSupabase()` is called. `isSupabaseConfigured` and the console
 * error stay eager so a deployment misconfiguration is still visible.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const configuredUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(configuredUrl && configuredAnonKey);

if (!isSupabaseConfigured) {
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Real Supabase sign-in is disabled; the local demo still works.",
  );
}

let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabase(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(
        configuredUrl || "http://localhost:54321",
        configuredAnonKey || "missing-anon-key",
        {
          auth: {
            // Supabase JS stores its session in localStorage by default.
            // We leave this as-is for real users.  Demo tokens are stored separately
            // in sessionStorage by AuthProvider.
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        },
      ),
    );
  }
  return clientPromise;
}

/** True when a Supabase session may already exist, so the SDK is worth loading. */
export function hasSupabaseSessionHint(): boolean {
  try {
    if (globalThis.location?.hash.includes("access_token")) {
      return true;
    }
    const storage = globalThis.localStorage;
    if (!storage) {
      return false;
    }
    return Object.keys(storage).some(
      (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
    );
  } catch {
    return false;
  }
}
