import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, type ReactNode } from 'react';
import { AuthProvider, ROLE_PERMISSIONS, type Permission } from './context/AuthContext';
import { ToastContainer } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import { StudentLayout, EmployeeLayout } from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import ScrollToTop from './components/ScrollToTop';
import NotFound from './pages/NotFound';
import { useAuth } from './context/AuthContext';
import { SkeletonPage } from './components/UI';

/* Auth pages (lazy) */
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));

/* Student pages (lazy) */
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'));
const StudentAdmission = lazy(() => import('./pages/student/Admission'));
const StudentExam = lazy(() => import('./pages/student/Exam'));
const StudentResults = lazy(() => import('./pages/student/Results'));

/* Employee pages (lazy) */
const EmployeeDashboard = lazy(() => import('./pages/employee/Dashboard'));
const EmployeeAdmissions = lazy(() => import('./pages/employee/Admissions'));
const EmployeeExams = lazy(() => import('./pages/employee/Exams'));
const EmployeeResults = lazy(() => import('./pages/employee/Results'));
const EmployeeReports = lazy(() => import('./pages/employee/Reports'));
const EmployeeUsers = lazy(() => import('./pages/employee/Users'));
const EmployeeAuditLog = lazy(() => import('./pages/employee/AuditLog'));
const EmployeeSettings = lazy(() => import('./pages/employee/Settings'));

/* Route guard: redirects to /employee if user doesn't have permission for the page */
function RoleGuard({ page, children }: { page: Permission; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'applicant') return <Navigate to="/student" replace />;
  const perms = ROLE_PERMISSIONS[user.role] || [];
  if (!perms.includes(page)) return <Navigate to="/employee" replace />;
  return <>{children}</>;
}

/* Route guard: ensures only applicants can access student routes */
function StudentGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'applicant') return <Navigate to="/employee" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <ConfirmProvider>
      <HashRouter>
        <ScrollToTop />
        <Suspense fallback={<div className="p-6"><SkeletonPage /></div>}>
        <Routes>
          {/* Public auth routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Student routes */}
          <Route path="/student" element={<StudentGuard><StudentLayout /></StudentGuard>}>
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
            <Route path="audit" element={<RoleGuard page="audit"><EmployeeAuditLog /></RoleGuard>} />
            <Route path="settings" element={<RoleGuard page="settings"><EmployeeSettings /></RoleGuard>} />
          </Route>

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Catch-all 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </HashRouter>
      </ConfirmProvider>
      <ToastContainer />
    </AuthProvider>
    </ErrorBoundary>
  );
}
