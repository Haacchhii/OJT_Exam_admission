import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ROLE_PERMISSIONS } from './context/AuthContext.jsx';
import { ToastContainer } from './components/Toast.jsx';
import { ConfirmProvider } from './components/ConfirmDialog.jsx';
import { StudentLayout, EmployeeLayout } from './components/Layout.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import NotFound from './pages/NotFound.jsx';
import { useAuth } from './context/AuthContext.jsx';

/* Auth pages */
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import ResetPassword from './pages/auth/ResetPassword.jsx';

/* Student pages */
import StudentDashboard from './pages/student/Dashboard.jsx';
import StudentAdmission from './pages/student/Admission.jsx';
import StudentExam from './pages/student/Exam.jsx';
import StudentResults from './pages/student/Results.jsx';

/* Employee pages */
import EmployeeDashboard from './pages/employee/Dashboard.jsx';
import EmployeeAdmissions from './pages/employee/Admissions.jsx';
import EmployeeExams from './pages/employee/Exams.jsx';
import EmployeeResults from './pages/employee/Results.jsx';
import EmployeeReports from './pages/employee/Reports.jsx';
import EmployeeUsers from './pages/employee/Users.jsx';

/* Route guard: redirects to /employee if user doesn't have permission for the page */
function RoleGuard({ page, children }) {
  const { user } = useAuth();
  if (!user || user.role === 'applicant') return <Navigate to="/login" replace />;
  const perms = ROLE_PERMISSIONS[user.role] || [];
  if (!perms.includes(page)) return <Navigate to="/employee" replace />;
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <ConfirmProvider>
      <HashRouter>
        <ScrollToTop />
        <Routes>
          {/* Public auth routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Student routes */}
          <Route path="/student" element={<StudentLayout />}>
            <Route index element={<StudentDashboard />} />
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="admission" element={<StudentAdmission />} />
            <Route path="exam" element={<StudentExam />} />
            <Route path="results" element={<StudentResults />} />
          </Route>

          {/* Employee routes */}
          <Route path="/employee" element={<EmployeeLayout />}>
            <Route index element={<EmployeeDashboard />} />
            <Route path="dashboard" element={<EmployeeDashboard />} />
            <Route path="admissions" element={<RoleGuard page="admissions"><EmployeeAdmissions /></RoleGuard>} />
            <Route path="exams" element={<RoleGuard page="exams"><EmployeeExams /></RoleGuard>} />
            <Route path="results" element={<RoleGuard page="results"><EmployeeResults /></RoleGuard>} />
            <Route path="reports" element={<RoleGuard page="reports"><EmployeeReports /></RoleGuard>} />
            <Route path="users" element={<RoleGuard page="users"><EmployeeUsers /></RoleGuard>} />
          </Route>

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Catch-all 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
      </ConfirmProvider>
      <ToastContainer />
    </AuthProvider>
    </ErrorBoundary>
  );
}
