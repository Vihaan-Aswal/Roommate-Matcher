/**
 * LoginPage.tsx — the door.
 *
 * Two routes in: a seeded demo workspace (the fast way to see the product) and
 * a real account. The demo is primary because a first-time visitor has no
 * credentials and nothing to lose; sign-in is the returning user's path.
 */
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { useAuth } from "../providers/AuthProvider";

export function LoginPage(): JSX.Element {
  const { signInWithEmail, startDemoSession, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const demoWorkspaceId = sessionStorage.getItem("demo_token")
        ? sessionStorage.getItem("demo_workspace_id")
        : null;
      navigate(demoWorkspaceId ? `/app/${demoWorkspaceId}/dashboard` : "/app");
    }
  }, [user, navigate]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleDemo() {
    setDemoError(null);
    setDemoLoading(true);
    try {
      await startDemoSession("demo@example.com");
      const wsId = sessionStorage.getItem("demo_workspace_id");
      navigate(wsId ? `/app/${wsId}/dashboard` : "/app");
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : "The demo workspace could not be created.");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="desk desk-canvas">
      <div className="desk-canvas-inner desk-canvas-page">
        <header className="desk-row-between">
          <Link className="desk-canvas-mark" to="/">
            Roommate Matcher
          </Link>
          <Link className="desk-btn desk-btn-field desk-btn-sm" to="/">
            <ArrowLeft size={13} strokeWidth={1.8} aria-hidden="true" />
            The argument
          </Link>
        </header>

        <div className="desk-canvas-body">
          <main className="desk-cols desk-cols-wide-left" style={{ gap: 44, alignItems: "center", width: "100%" }}>
          <div>
            <h1
              className="desk-mast-title"
              style={{ color: "var(--ink)", fontSize: "clamp(2rem, 3.4vw, 2.9rem)", lineHeight: 1.02 }}
            >
              Open the desk.
            </h1>
            <p className="desk-canvas-lede" style={{ marginTop: 14, maxWidth: "46ch" }}>
              Room-allocation work for hostel offices: a roster, a room list, a preference form, and a
              proposal with a written reason for every student.
            </p>
            <dl className="desk-kv" style={{ marginTop: 26, color: "var(--ink-dim)" }}>
              <dt style={{ color: "var(--ink-faint)" }}>Boundaries</dt>
              <dd>Gender, year group, AC type, room size — nothing crosses them.</dd>
              <dt style={{ color: "var(--ink-faint)" }}>Score</dt>
              <dd>Ten weighted factors per eligible pair, missing answers renormalised.</dd>
              <dt style={{ color: "var(--ink-faint)" }}>Output</dt>
              <dd>A proposal, the reasons, the fairness floor. A person signs.</dd>
            </dl>
          </div>

          <div className="desk-sheet m-slip" style={{ padding: "24px 24px 22px" }}>
            <h2 style={{ fontSize: "1.35rem", lineHeight: 1.15 }}>
              A workspace you can throw away.
            </h2>
            <p className="desk-help" style={{ marginTop: 8 }}>
              Creates a seeded workspace with illustrative students, rooms and responses. No account,
              no email confirmation, nothing kept after you leave it.
            </p>

            {demoError ? (
              <p className="desk-note" data-tone="error" role="alert" style={{ marginTop: 14 }}>
                <span className="desk-note-body">
                  <strong className="desk-note-title">The demo could not start.</strong> {demoError}
                </span>
              </p>
            ) : null}

            <button
              className="desk-btn desk-btn-lg desk-btn-block"
              style={{ marginTop: 16 }}
              type="button"
              onClick={() => void handleDemo()}
              disabled={demoLoading}
            >
              {demoLoading ? (
                "Creating the workspace…"
              ) : (
                <>
                  Open the demo workspace
                  <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
                </>
              )}
            </button>

            <hr className="desk-rule" style={{ margin: "22px 0 18px" }} />

            <form onSubmit={handleLogin} className="desk-stack-sm" noValidate>
              <div>
                <p className="desk-overline">Sign in</p>
                <p className="desk-help" style={{ marginTop: 4 }}>
                  For an account your institute already administers.
                </p>
              </div>

              <div className="desk-field">
                <label className="desk-label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  className="desk-input"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  aria-invalid={loginError ? true : undefined}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div className="desk-field">
                <label className="desk-label" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  className="desk-input"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  aria-invalid={loginError ? true : undefined}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <div aria-live="polite">
                {loginError ? (
                  <p className="desk-error" role="alert">
                    {loginError}
                  </p>
                ) : null}
              </div>

              <button className="desk-btn desk-btn-ghost desk-btn-block" type="submit" disabled={loginLoading}>
                {loginLoading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>
          </main>
        </div>

        <p
          className="desk-mono"
          style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}
        >
          Roommate Matcher · room allocation desk · a proposal, not a key
        </p>
      </div>
    </div>
  );
}
