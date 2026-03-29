import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";

import { AdminLayout } from "./layouts/AdminLayout";
import { AdminAtRiskReview } from "./pages/AdminAtRiskReview";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminFairness } from "./pages/AdminFairness";
import { AdminFormCollection } from "./pages/AdminFormCollection";
import { AdminManualChecker } from "./pages/AdminManualChecker";
import { AdminMatchingRuns } from "./pages/AdminMatchingRuns";
import { AdminStudentsData } from "./pages/AdminStudentsData";
import { StudentForm } from "./pages/StudentForm";

export default function App(): JSX.Element {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate replace to="/admin/dashboard" />} />
        <Route path="/form" element={<StudentForm />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate replace to="dashboard" />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="students-data" element={<AdminStudentsData />} />
          <Route path="form-collection" element={<AdminFormCollection />} />
          <Route path="matching-runs" element={<AdminMatchingRuns />} />
          <Route path="fairness" element={<AdminFairness />} />
          <Route path="at-risk-review" element={<AdminAtRiskReview />} />
          <Route path="manual-checker" element={<AdminManualChecker />} />
        </Route>

        <Route path="*" element={<Navigate replace to="/admin/dashboard" />} />
      </Routes>
    </Router>
  );
}
