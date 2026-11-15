import React from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";

import { useAuth } from "./providers/AuthProvider";
import { WorkspaceProvider } from "./providers/WorkspaceProvider";
import { AdminLayout } from "./layouts/AdminLayout";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { WorkspaceChooserPage } from "./pages/WorkspaceChooserPage";
import { AdminAtRiskReview } from "./pages/AdminAtRiskReview";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminFairness } from "./pages/AdminFairness";
import { AdminFormCollection } from "./pages/AdminFormCollection";
import { AdminManualChecker } from "./pages/AdminManualChecker";
import { AdminMatchingRuns } from "./pages/AdminMatchingRuns";
import { AdminStudentsData } from "./pages/AdminStudentsData";
import { StudentForm } from "./pages/StudentForm";
import { RoomResultsPage } from "./pages/matching/RoomResultsPage";
import { StudentResultsPage } from "./pages/matching/StudentResultsPage";
import { PlatformTenantsPage } from "./pages/platform/PlatformTenantsPage";
import { PlatformTenantWorkspacesPage } from "./pages/platform/PlatformTenantWorkspacesPage";
import { Toaster } from "./components/ui/toaster";

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
    <Router>
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
      <Toaster />
    </Router>
  );
}
