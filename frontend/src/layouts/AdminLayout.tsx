import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
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
      { to: "students-data", label: "Students & Data" },
      { to: "form-collection", label: "Form & Collection" },
    ],
  },
  {
    label: "Run",
    links: [{ to: "matching-runs", label: "Matching Runs" }],
  },
  {
    label: "Review",
    links: [
      { to: "fairness", label: "Reports & Fairness" },
      { to: "at-risk-review", label: "At-Risk Review" },
      { to: "manual-checker", label: "Manual Checker" },
    ],
  },
];

function DeskNav(): JSX.Element {
  return (
    <nav className="desk-nav" aria-label="Workspace">
      <NavLink className="desk-nav-link" to="dashboard">
        Dashboard
      </NavLink>
      {groups.map((group) => (
        <div className="desk-nav-group" key={group.label}>
          <p className="desk-nav-label">{group.label}</p>
          {group.links.map((link) => (
            <NavLink className="desk-nav-link" key={link.to} to={link.to}>
              {link.label}
            </NavLink>
          ))}
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
