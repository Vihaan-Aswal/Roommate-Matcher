import { NavLink, Outlet } from "react-router-dom";

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
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#fdf7ef_0%,_#fff_40%,_#f3f8f6_100%)]">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 md:grid-cols-[280px_1fr]">
        <aside className="border-r border-border/70 bg-white/80 p-6 backdrop-blur">
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
        </aside>

        <main className="p-6 md:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
