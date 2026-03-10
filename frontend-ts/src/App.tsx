import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, type ReactNode } from 'react';
import { AuthProvider, ROLE_PERMISSIONS, type Permission } from './context/AuthContext';
import { ToastContainer } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import { StudentLayout, EmployeeLayout } from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import PageErrorBoundary from './components/PageErrorBoundary';
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
            <Route index element={<PageErrorBoundary pageName="Dashboard"><StudentDashboard /></PageErrorBoundary>} />
            <Route path="dashboard" element={<PageErrorBoundary pageName="Dashboard"><StudentDashboard /></PageErrorBoundary>} />
            <Route path="admission" element={<PageErrorBoundary pageName="Admission"><StudentAdmission /></PageErrorBoundary>} />
            <Route path="exam" element={<PageErrorBoundary pageName="Exam"><StudentExam /></PageErrorBoundary>} />
            <Route path="results" element={<PageErrorBoundary pageName="Results"><StudentResults /></PageErrorBoundary>} />
          </Route>

          {/* Employee routes */}
          <Route path="/employee" element={<EmployeeLayout />}>
            <Route index element={<PageErrorBoundary pageName="Dashboard"><EmployeeDashboard /></PageErrorBoundary>} />
            <Route path="dashboard" element={<PageErrorBoundary pageName="Dashboard"><EmployeeDashboard /></PageErrorBoundary>} />
            <Route path="admissions" element={<RoleGuard page="admissions"><PageErrorBoundary pageName="Admissions"><EmployeeAdmissions /></PageErrorBoundary></RoleGuard>} />
            <Route path="exams" element={<RoleGuard page="exams"><PageErrorBoundary pageName="Exams"><EmployeeExams /></PageErrorBoundary></RoleGuard>} />
            <Route path="results" element={<RoleGuard page="results"><PageErrorBoundary pageName="Results"><EmployeeResults /></PageErrorBoundary></RoleGuard>} />
            <Route path="reports" element={<RoleGuard page="reports"><PageErrorBoundary pageName="Reports"><EmployeeReports /></PageErrorBoundary></RoleGuard>} />
            <Route path="users" element={<RoleGuard page="users"><PageErrorBoundary pageName="Users"><EmployeeUsers /></PageErrorBoundary></RoleGuard>} />
            <Route path="audit" element={<RoleGuard page="audit"><PageErrorBoundary pageName="Audit Log"><EmployeeAuditLog /></PageErrorBoundary></RoleGuard>} />
            <Route path="settings" element={<RoleGuard page="settings"><PageErrorBoundary pageName="Settings"><EmployeeSettings /></PageErrorBoundary></RoleGuard>} />
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
