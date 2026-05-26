/**
 * LoginPage.tsx
 *
 * Shown to unauthenticated users at the root "/" path.
 *
 * Two flows:
 *   1. Email + password sign-in via Supabase Auth.
 *   2. Demo session — enter just an email (display only), click "Try Demo",
 *      and the backend creates an isolated sandbox.
 *
 * On success, both flows update the AuthProvider state and the ProtectedRoute
 * in App.tsx redirects to /app/dashboard.
 */
import React, { useState } from "react";
import { useAuth } from "../providers/AuthProvider";

export function LoginPage() {
  const { signInWithEmail, startDemoSession } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [demoEmail, setDemoEmail] = useState("");

  const [loginError, setLoginError] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      await signInWithEmail(email, password);
      // AuthProvider onAuthStateChange handles redirect via ProtectedRoute
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleDemo(e: React.FormEvent) {
    e.preventDefault();
    setDemoError(null);
    setDemoLoading(true);
    try {
      await startDemoSession(demoEmail || "demo@example.com");
      // AuthProvider sets user → ProtectedRoute redirects
    } catch (err: unknown) {
      setDemoError(err instanceof Error ? err.message : "Failed to start demo.");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Roommate Matcher</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to your account or try a live demo.
          </p>
        </div>

        {/* Real login */}
        <form onSubmit={handleLogin} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Sign In</h2>
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••••"
            />
          </div>
          {loginError && (
            <p className="text-sm text-destructive">{loginError}</p>
          )}
          <button
            type="submit"
            disabled={loginLoading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loginLoading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        {/* Demo */}
        <form onSubmit={handleDemo} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Try the Demo</h2>
          <p className="text-sm text-muted-foreground">
            No sign-up required. Enter an email for display purposes only.
          </p>
          <div className="space-y-2">
            <label htmlFor="demo-email" className="block text-sm font-medium">
              Your email <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              id="demo-email"
              type="email"
              value={demoEmail}
              onChange={(e) => setDemoEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="demo@example.com"
            />
          </div>
          {demoError && (
            <p className="text-sm text-destructive">{demoError}</p>
          )}
          <button
            type="submit"
            disabled={demoLoading}
            className="w-full rounded-md border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
          >
            {demoLoading ? "Creating sandbox…" : "Launch Demo →"}
          </button>
        </form>
      </div>
    </div>
  );
}
