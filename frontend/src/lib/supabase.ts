/**
 * supabase.ts — singleton Supabase browser client.
 *
 * Import `supabase` anywhere in the frontend to access the Supabase JS client.
 * This is the ONLY place where the client is instantiated.
 *
 * A missing environment must not crash the whole app: the demo workspace is
 * local and needs no Supabase. When the two variables are absent we build a
 * placeholder client (it performs no network call until auth is used) and log
 * an error so a real deployment misconfiguration is still visible.
 */
import { createClient } from "@supabase/supabase-js";

const configuredUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(configuredUrl && configuredAnonKey);

if (!isSupabaseConfigured) {
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Real Supabase sign-in is disabled; the local demo still works.",
  );
}

export const supabase = createClient(
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
);
