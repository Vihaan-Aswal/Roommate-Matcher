import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";

import { useAuth } from "../providers/AuthProvider";
import { useWorkspace } from "../providers/WorkspaceProvider";
import { ImpersonationBanner } from "../components/ImpersonationBanner";

/**
 * The desk: a dark forest rail holding the workspace and the work sequence,
 * and one cream ledger page for the route. Navigation is grouped by the order
 * the job happens — set up, run, review — not by feature list.
 */
const groups = [
  {
    label: "Setup",
    links: [
      { key: "students-data", label: "Students & Data" },
      { key: "form-collection", label: "Form & Collection" },
    ],
  },
  {
    label: "Run",
    links: [{ key: "matching-runs", label: "Matching Runs" }],
  },
  {
    label: "Review",
    links: [
      { key: "fairness", label: "Reports & Fairness" },
      { key: "at-risk-review", label: "At-Risk Review" },
      { key: "manual-checker", label: "Manual Checker" },
    ],
  },
];

/**
 * Which nav row the user believes they are on.
 *
 * At-risk review has no route of its own: it opens the student register with
 * `atRisk=1`, so the URL's section is still `matching-runs`. The review state is
 * the better truth, and it is derived from that same URL — no route changes.
 */
function useActiveNavKey(): string {
  const { pathname, search } = useLocation();

  const inStudentRegister = /\/matching-runs\/[^/]+\/students\/?$/.test(pathname);
  if (inStudentRegister && new URLSearchParams(search).get("atRisk") === "1") {
    return "at-risk-review";
  }

  return pathname.replace(/^\/app\/[^/]+/, "").split("/")[1] ?? "";
}

function DeskNav(): JSX.Element {
  const activeKey = useActiveNavKey();

  const navLink = (key: string, label: string): JSX.Element => (
    <Link
      aria-current={activeKey === key ? "page" : undefined}
      className="desk-nav-link"
      key={key}
      to={key}
    >
      {label}
    </Link>
  );

  return (
    <nav className="desk-nav" aria-label="Workspace">
      {navLink("dashboard", "Dashboard")}
      {groups.map((group) => (
        <div className="desk-nav-group" key={group.label}>
          <p className="desk-nav-label">{group.label}</p>
          {group.links.map((link) => navLink(link.key, link.label))}
        </div>
      ))}
    </nav>
  );
}

export function AdminLayout(): JSX.Element {
  const { user, signOut } = useAuth();
  const { workspaceName } = useWorkspace();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  const workspaceLabel = workspaceName ?? "This workspace";

  const userFoot = (
    <>
      <p className="desk-rail-role">
        {user?.role ?? "member"}
        {user?.isDemo ? " · demo" : ""}
      </p>
      <p className="desk-rail-user">{user?.email}</p>
    </>
  );

  const signOutButton = (
    <button className="desk-btn desk-btn-field desk-btn-sm" type="button" onClick={() => void handleSignOut()}>
      <LogOut size={13} strokeWidth={1.8} aria-hidden="true" />
      Sign out
    </button>
  );

  return (
    <div className="desk">
      <a className="desk-skip" href="#desk-main">
        Skip to the page
      </a>
      <ImpersonationBanner />

      <div className="desk-shell">
        <aside className="desk-rail">
          <Link className="desk-rail-mark" to="/app">
            Roommate Matcher
          </Link>
          <p className="desk-rail-sub">Room allocation desk</p>

          <div className="desk-ws">
            <p className="desk-ws-label">Workspace</p>
            <p className="desk-ws-name">{workspaceLabel}</p>
            <Link className="desk-ws-switch" to="/app">
              Switch workspace
            </Link>
          </div>

          <DeskNav />

          <div className="desk-rail-foot">
            {userFoot}
            <div className="desk-rail-footrow">{signOutButton}</div>
          </div>
        </aside>

        <div className="desk-topbar desk-on-field">
          <div className="desk-topbar-row">
            <div className="min-w-0">
              <Link className="desk-rail-mark" to="/app">
                Roommate Matcher
              </Link>
              <p className="desk-topbar-ws">{workspaceLabel}</p>
            </div>
            <details className="desk-menu">
              <summary>
                <Menu size={14} strokeWidth={1.8} aria-hidden="true" />
                Menu
              </summary>
              <div className="desk-menu-body">
                <DeskNav />
                <div className="desk-menu-foot">
                  <div>{userFoot}</div>
                  {signOutButton}
                </div>
              </div>
            </details>
          </div>
        </div>

        <main className="desk-paper" id="desk-main" tabIndex={-1}>
          <div className="desk-page">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
