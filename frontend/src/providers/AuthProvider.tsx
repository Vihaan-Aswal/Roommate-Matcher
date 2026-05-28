/**
 * AuthProvider.tsx
 *
 * Single source of truth for auth state in the frontend.
 *
 * Two session types:
 *   1. Supabase session  — managed by Supabase JS client, persisted in localStorage.
 *   2. Demo session      — app JWT stored in sessionStorage under key "demo_token".
 *
 * On mount the provider:
 *   a. Checks for a demo token in sessionStorage.  If found, calls GET /api/auth/me
 *      to validate it and populate the user context.
 *   b. Otherwise checks the Supabase session.  If a Supabase session exists,
 *      calls POST /api/auth/session to exchange it for our app's session metadata.
 *   c. If neither exists, sets user to null (unauthenticated).
 *
 * The provider also subscribes to Supabase's onAuthStateChange so that
 * sign-in / sign-out events from any tab are reflected immediately.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { setApiToken } from "../lib/apiClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AppUser {
  authKind: "supabase" | "app_jwt";
  supabaseUserId: string;
  email: string;
  tenantId: string;
  role: "owner" | "admin" | "viewer";
  isDemo: boolean;
  isPlatformAdmin: boolean;
  impersonatedTenantId: string | null;
}

interface AuthState {
  user: AppUser | null;
  isLoading: boolean;
  /** Raw token to attach as Authorization: Bearer <token> for API calls. */
  token: string | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  startDemoSession: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEMO_TOKEN_KEY = "demo_token";
const IMPERSONATION_TOKEN_KEY = "impersonation_token";
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? "";

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setApiToken(token);
  }, [token]);

  // --- Internal: populate state from our backend ---
  const hydrateFromBackend = useCallback(async (rawToken: string) => {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${rawToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const appUser: AppUser = {
      authKind: data.auth_kind,
      supabaseUserId: data.supabase_user_id,
      email: data.email,
      tenantId: data.tenant_id,
      role: data.role,
      isDemo: data.is_demo,
      isPlatformAdmin: data.is_platform_admin,
      impersonatedTenantId: data.impersonated_tenant_id ?? null,
    };
    return appUser;
  }, []);

  // --- Internal: exchange Supabase access_token with our backend ---
  const exchangeSupabaseToken = useCallback(
    async (accessToken: string): Promise<AppUser | null> => {
      const res = await fetch(`${API_BASE}/api/auth/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        authKind: "supabase",
        supabaseUserId: data.supabase_user_id,
        email: data.email,
        tenantId: data.tenant_id,
        role: data.role,
        isDemo: false,
        isPlatformAdmin: data.is_platform_admin,
        impersonatedTenantId: null,
      };
    },
    []
  );

  // --- Bootstrap on mount ---
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setIsLoading(true);

      // Check for demo token first
      const demoToken = sessionStorage.getItem(DEMO_TOKEN_KEY);
      // Also check for impersonation token (platform admin entering tenant)
      const impersonationToken = sessionStorage.getItem(IMPERSONATION_TOKEN_KEY);
      const appSessionToken = demoToken ?? impersonationToken;

      if (appSessionToken) {
        const appUser = await hydrateFromBackend(appSessionToken);
        if (!cancelled) {
          if (appUser) {
            setUser(appUser);
            setToken(appSessionToken);
          } else {
            // Token invalid/expired — clear it
            sessionStorage.removeItem(DEMO_TOKEN_KEY);
            sessionStorage.removeItem(IMPERSONATION_TOKEN_KEY);
          }
          setIsLoading(false);
          return;
        }
      }

      // Check for Supabase session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token && !cancelled) {
        const appUser = await exchangeSupabaseToken(session.access_token);
        if (!cancelled) {
          setUser(appUser);
          setToken(session.access_token);
        }
      }

      if (!cancelled) setIsLoading(false);
    }

    bootstrap();

    // Subscribe to Supabase auth changes (sign-in / sign-out / token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;
      if (session?.access_token) {
        const appUser = await exchangeSupabaseToken(session.access_token);
        setUser(appUser);
        setToken(session.access_token);
      } else {
        // Check if we're still on a demo session before clearing
        const demoToken = sessionStorage.getItem(DEMO_TOKEN_KEY);
        if (!demoToken) {
          setUser(null);
          setToken(null);
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [hydrateFromBackend, exchangeSupabaseToken]);

  // --- Public actions ---

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      // onAuthStateChange fires automatically — no need to set state here
    },
    []
  );

  const startDemoSession = useCallback(async (email: string) => {
    const res = await fetch(`${API_BASE}/api/auth/demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? "Failed to start demo session.");
    }
    const data = await res.json();
    sessionStorage.setItem(DEMO_TOKEN_KEY, data.token);
    sessionStorage.setItem("demo_workspace_id", data.workspace_id); // NEW

    // Immediately hydrate
    setApiToken(data.token);
    const appUser = await hydrateFromBackend(data.token);
    setUser(appUser);
    setToken(data.token);
  }, [hydrateFromBackend]);

  const signOut = useCallback(async () => {
    sessionStorage.removeItem(DEMO_TOKEN_KEY);
    setUser(null);
    setToken(null);
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, isLoading, token, signInWithEmail, startDemoSession, signOut }),
    [user, isLoading, token, signInWithEmail, startDemoSession, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
