import React, { Suspense, lazy } from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";

import { useAuth } from "./providers/AuthProvider";
import { WorkspaceProvider } from "./providers/WorkspaceProvider";
import { AdminLayout } from "./layouts/AdminLayout";
import { HomePage } from "./pages/HomePage";
import { Toaster } from "./components/ui/toaster";

// The public landing page ships in the initial chunk; every authenticated
// surface is loaded on its route so a first visit does not download the desk.
const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const WorkspaceChooserPage = lazy(() =>
  import("./pages/WorkspaceChooserPage").then((m) => ({ default: m.WorkspaceChooserPage })),
);
const AdminAtRiskReview = lazy(() =>
  import("./pages/AdminAtRiskReview").then((m) => ({ default: m.AdminAtRiskReview })),
);
const AdminDashboard = lazy(() =>
  import("./pages/AdminDashboard").then((m) => ({ default: m.AdminDashboard })),
);
const AdminFairness = lazy(() =>
  import("./pages/AdminFairness").then((m) => ({ default: m.AdminFairness })),
);
const AdminFormCollection = lazy(() =>
  import("./pages/AdminFormCollection").then((m) => ({ default: m.AdminFormCollection })),
);
const AdminManualChecker = lazy(() =>
  import("./pages/AdminManualChecker").then((m) => ({ default: m.AdminManualChecker })),
);
const AdminMatchingRuns = lazy(() =>
  import("./pages/AdminMatchingRuns").then((m) => ({ default: m.AdminMatchingRuns })),
);
const AdminStudentsData = lazy(() =>
  import("./pages/AdminStudentsData").then((m) => ({ default: m.AdminStudentsData })),
);
const StudentForm = lazy(() =>
  import("./pages/StudentForm").then((m) => ({ default: m.StudentForm })),
);
const RoomResultsPage = lazy(() =>
  import("./pages/matching/RoomResultsPage").then((m) => ({ default: m.RoomResultsPage })),
);
const StudentResultsPage = lazy(() =>
  import("./pages/matching/StudentResultsPage").then((m) => ({ default: m.StudentResultsPage })),
);
const PlatformTenantsPage = lazy(() =>
  import("./pages/platform/PlatformTenantsPage").then((m) => ({ default: m.PlatformTenantsPage })),
);
const PlatformTenantWorkspacesPage = lazy(() =>
  import("./pages/platform/PlatformTenantWorkspacesPage").then((m) => ({
    default: m.PlatformTenantWorkspacesPage,
  })),
);

/**
 * DeskBoot — what the page shows while auth is still resolving. It is the desk's
 * field with a mono note, not a spinner: a cold load must not paint a different
 * product for half a second.
 */
function DeskBoot(): JSX.Element {
  return (
    <div className="desk desk-canvas">
      <div className="desk-canvas-inner">
        <p className="desk-loading-note" style={{ color: "var(--ink-faint)" }}>
          Reading the desk
        </p>
      </div>
    </div>
  );
}

/**
 * PlatformRoute — restricts access to platform admins only.
 */
function PlatformRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <DeskBoot />;
  }

  if (!user) return <Navigate replace to="/login" />;
  if (!user.isPlatformAdmin) return <Navigate replace to="/app" />;

  return <>{children}</>;
}

/**
 * ProtectedRoute — renders children only when the user is authenticated.
 * Shows the desk's boot state while AuthProvider is bootstrapping.
 * Redirects to /login otherwise.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <DeskBoot />;
  }

  if (!user) {
    return <Navigate replace to="/login" />;
  }

  return <>{children}</>;
}

export default function App(): JSX.Element {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<DeskBoot />}>
        <Routes>
          {/* Public homepage */}
          <Route path="/" element={<HomePage />} />

          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />

          {/* Public student-facing form — no auth required */}
          <Route path="/f/:token" element={<StudentForm />} />

          {/* Chooser page */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <WorkspaceChooserPage />
              </ProtectedRoute>
            }
          />

          {/* Platform Routes */}
          <Route
            path="/platform"
            element={
              <PlatformRoute>
                <PlatformTenantsPage />
              </PlatformRoute>
            }
          />
          <Route
            path="/platform/tenants/:tenantId/workspaces"
            element={
              <PlatformRoute>
                <PlatformTenantWorkspacesPage />
              </PlatformRoute>
            }
          />

          {/* Protected workspace routes */}
          <Route
            path="/app/:workspaceId"
            element={
              <ProtectedRoute>
                <WorkspaceProvider>
                  <AdminLayout />
                </WorkspaceProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate replace to="dashboard" />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="students-data" element={<AdminStudentsData />} />
            <Route path="form-collection" element={<AdminFormCollection />} />
            <Route path="matching-runs" element={<AdminMatchingRuns />} />
            <Route path="matching-runs/:runId/rooms" element={<RoomResultsPage />} />
            <Route path="matching-runs/:runId/students" element={<StudentResultsPage />} />
            <Route path="fairness" element={<AdminFairness />} />
            <Route path="fairness/:runId" element={<AdminFairness />} />
            <Route path="at-risk-review" element={<AdminAtRiskReview />} />
            <Route path="manual-checker" element={<AdminManualChecker />} />
          </Route>

          {/* Legacy redirect */}
          <Route path="/admin/*" element={<Navigate replace to="/app" />} />

          {/* Catch-all → login */}
          <Route path="*" element={<Navigate replace to="/login" />} />
        </Routes>
      </Suspense>
      <Toaster />
    </Router>
  );
}
