import React from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";

import { useAuth } from "./providers/AuthProvider";
import { WorkspaceProvider } from "./providers/WorkspaceProvider";
import { AdminLayout } from "./layouts/AdminLayout";
import { LoginPage } from "./pages/LoginPage";
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

/**
 * ProtectedRoute — renders children only when the user is authenticated.
 * Shows a loading spinner while AuthProvider is bootstrapping.
 * Redirects to /login otherwise.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
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
        {/* Root redirect */}
        <Route path="/" element={<Navigate replace to="/login" />} />

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
    </Router>
  );
}
