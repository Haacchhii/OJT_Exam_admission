import { HashRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Suspense, useEffect, type ReactNode } from 'react';
import { AuthProvider, ROLE_PERMISSIONS, type Permission } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastContainer } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import { StudentLayout, EmployeeLayout } from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import PageErrorBoundary from './components/PageErrorBoundary';
import ScrollToTop from './components/ScrollToTop';
import NotFound from './pages/NotFound';
import { useAuth } from './context/AuthContext';
import { LoadingSpinner } from './components/UI';
import { lazyWithRetry, LazyLoadingFallback } from './components/lazyWithRetry';

/* Auth pages — eager load (first paint for most users) */
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import VerifyEmail from './pages/auth/VerifyEmail';

/* Student pages (lazy with retry) */
const StudentDashboard = lazyWithRetry(() => import('./pages/student/Dashboard'));
const StudentAdmission = lazyWithRetry(() => import('./pages/student/Admission'));
const StudentExam = lazyWithRetry(() => import('./pages/student/Exam'));
const StudentResults = lazyWithRetry(() => import('./pages/student/Results'));
const StudentApplicationTracker = lazyWithRetry(() => import('./pages/student/ApplicationTracker'));

/* Employee pages (lazy with retry) */
const EmployeeDashboard = lazyWithRetry(() => import('./pages/employee/Dashboard'));
const EmployeeAdmissions = lazyWithRetry(() => import('./pages/employee/Admissions'));
const EmployeeExams = lazyWithRetry(() => import('./pages/employee/Exams'));
const EmployeeResults = lazyWithRetry(() => import('./pages/employee/Results'));
const EmployeeReports = lazyWithRetry(() => import('./pages/employee/Reports'));
const EmployeeUsers = lazyWithRetry(() => import('./pages/employee/Users'));
const EmployeeAuditLog = lazyWithRetry(() => import('./pages/employee/AuditLog'));
const EmployeeSettings = lazyWithRetry(() => import('./pages/employee/Settings'));
const Profile = lazyWithRetry(() => import('./pages/shared/Profile'));

/* Route guard: redirects to /employee if user doesn't have permission for the page */
function RoleGuard({ page, children }: { page: Permission; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'applicant') return <Navigate to="/student" replace />;
  const perms = ROLE_PERMISSIONS[user.role] || [];
  if (!perms.includes(page)) {
    return (
      <div className="max-w-2xl mx-auto gk-section-card p-8 text-center">
        <h2 className="text-xl font-bold text-red-600 mb-2">Access Restricted</h2>
        <p className="text-gray-500 mb-5">Your role does not have permission to access this page.</p>
        <Link to="/employee/dashboard" className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-forest-600 text-white text-sm font-semibold hover:bg-forest-700">
          Back to Dashboard
        </Link>
      </div>
    );
  }
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
  useEffect(() => {
    // Dark mode has been removed; clear any stale class or persisted flag.
    try {
      document.documentElement.classList.remove('dark');
      localStorage.removeItem('gk_dark');
    } catch {
      // Ignore storage access issues
    }
  }, []);

  return (
    <ErrorBoundary>
    <AuthProvider>
      <SocketProvider>
        <ConfirmProvider>
      <HashRouter>
        <ScrollToTop />
        <Suspense fallback={<LazyLoadingFallback />}>
        <Routes>
          {/* Public auth routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="verify-email" element={<VerifyEmail />} />

          {/* Student routes */}
          <Route path="/student" element={<StudentGuard><StudentLayout /></StudentGuard>}>
            <Route index element={<PageErrorBoundary pageName="Dashboard"><StudentDashboard /></PageErrorBoundary>} />
            <Route path="dashboard" element={<PageErrorBoundary pageName="Dashboard"><StudentDashboard /></PageErrorBoundary>} />
            <Route path="admission" element={<PageErrorBoundary pageName="Admission"><StudentAdmission /></PageErrorBoundary>} />
            <Route path="track" element={<PageErrorBoundary pageName="Track Application"><StudentApplicationTracker /></PageErrorBoundary>} />
            <Route path="exam" element={<PageErrorBoundary pageName="Exam"><StudentExam /></PageErrorBoundary>} />
            <Route path="results" element={<PageErrorBoundary pageName="Results"><StudentResults /></PageErrorBoundary>} />
            <Route path="profile" element={<PageErrorBoundary pageName="Profile"><Profile /></PageErrorBoundary>} />
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
            <Route path="profile" element={<PageErrorBoundary pageName="Profile"><Profile /></PageErrorBoundary>} />
          </Route>

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Catch-all 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </HashRouter>
      </ConfirmProvider>
        </SocketProvider>
      <ToastContainer />
    </AuthProvider>
    </ErrorBoundary>
  );
}
