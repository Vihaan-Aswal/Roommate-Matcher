/**
 * supabase.ts — singleton Supabase browser client.
 *
 * Import `supabase` anywhere in the frontend to access the Supabase JS client.
 * This is the ONLY place where the client is instantiated.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
    "Check your frontend/.env.local file."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Supabase JS stores its session in localStorage by default.
    // We leave this as-is for real users.  Demo tokens are stored separately
    // in sessionStorage by AuthProvider.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
