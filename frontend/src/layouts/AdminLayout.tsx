import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

const links = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/students-data", label: "Students & Data" },
  { to: "/admin/form-collection", label: "Form & Collection" },
  { to: "/admin/matching-runs", label: "Matching Runs" },
  { to: "/admin/fairness", label: "Reports & Fairness" },
  { to: "/admin/at-risk-review", label: "At-Risk Review" },
  { to: "/admin/manual-checker", label: "Manual Checker" },
];

export function AdminLayout(): JSX.Element {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#fdf7ef_0%,_#fff_40%,_#f3f8f6_100%)]">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 md:grid-cols-[280px_1fr]">
        <aside className="border-r border-border/70 bg-white/80 p-6 backdrop-blur flex flex-col">
          <h1 className="font-serif text-2xl font-bold tracking-tight">
            Roommate Matcher
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Admin Operations</p>

          <nav className="mt-6 space-y-2">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  [
                    "block rounded-lg px-3 py-2 text-sm transition",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-secondary",
                  ].join(" ")
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* User section — add at bottom of aside */}
          <div className="mt-auto pt-6 border-t border-border/50">
            {user?.isDemo && (
              <span className="mb-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                Demo Mode
              </span>
            )}
            <p className="text-sm font-medium truncate">{user?.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            <button
              onClick={handleSignOut}
              className="mt-3 w-full rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-destructive hover:text-destructive transition-colors"
            >
              Sign out
            </button>
          </div>
        </aside>

        <main className="p-6 md:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
