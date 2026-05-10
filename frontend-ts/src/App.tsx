import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { Suspense, useEffect, type ReactNode } from 'react';
import { AuthProvider, ROLE_PERMISSIONS, useAuth, type Permission } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastContainer } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import { StudentLayout, EmployeeLayout } from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import PageErrorBoundary from './components/PageErrorBoundary';
import ScrollToTop from './components/ScrollToTop';
import NotFound from './pages/NotFound';
import { LoadingSpinner } from './components/UI';
import { lazyWithRetry, LazyLoadingFallback } from './components/lazyWithRetry';
import { prefetchLikelyRoutesForRole } from './utils/routePrefetch';

/* Auth pages — eager load (first paint for most users) */
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import ChangePassword from './pages/auth/ChangePassword';
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
const ExamPreview = lazyWithRetry(() => import('./pages/employee/exams/ExamPreview'));
const EmployeeResults = lazyWithRetry(() => import('./pages/employee/Results'));
const EmployeeReports = lazyWithRetry(() => import('./pages/employee/Reports'));
const EmployeeRegistrarRecords = lazyWithRetry(() => import('./pages/employee/RegistrarRecords'));
const EmployeeUsers = lazyWithRetry(() => import('./pages/employee/Users'));
const EmployeeAuditLog = lazyWithRetry(() => import('./pages/employee/AuditLog'));
const EmployeeSettings = lazyWithRetry(() => import('./pages/employee/Settings'));
const Profile = lazyWithRetry(() => import('./pages/shared/Profile'));

/* Route guard: redirects to /employee if user doesn't have permission for the page */
function RoleGuard({ page, children }: { page: Permission; children: ReactNode }) {
  const { user, authReady } = useAuth();
  if (!authReady) {
    return (
      <div className="min-h-screen grid place-items-center gk-mesh-bg">
        <LoadingSpinner />
      </div>
    );
  }
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
  const { user, authReady } = useAuth();
  if (!authReady) {
    return (
      <div className="min-h-screen grid place-items-center gk-mesh-bg">
        <LoadingSpinner />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'applicant') return <Navigate to="/employee" replace />;
  return <>{children}</>;
}

function FirstLoginGuard({ children }: { children: ReactNode }) {
  const { user, authReady } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return (
      <div className="min-h-screen grid place-items-center gk-mesh-bg">
        <LoadingSpinner />
      </div>
    );
  }

  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}

function RoleRoutePrefetcher() {
  const { user, authReady } = useAuth();

  useEffect(() => {
    if (!authReady || !user) return;
    const role = user.role;
    const currentPath = window.location.hash ? window.location.hash.slice(1) : '/';
    prefetchLikelyRoutesForRole(role, currentPath);
  }, [authReady, user?.role]);

  return null;
}

function withLazyPageBoundary(pageName: string, page: ReactNode) {
  return (
    <PageErrorBoundary pageName={pageName}>
      <Suspense fallback={<LazyLoadingFallback />}>
        {page}
      </Suspense>
    </PageErrorBoundary>
  );
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

    // Call health endpoint on app mount for server readiness check
    fetch('/api/health', { method: 'GET' }).catch(() => {
      console.warn('Health check failed; backend may be unavailable');
    });
  }, []);

  return (
    <ErrorBoundary>
    <AuthProvider>
      <SocketProvider>
        <ConfirmProvider>
      <HashRouter>
        <ScrollToTop />
        <RoleRoutePrefetcher />
        <FirstLoginGuard>
        <Routes>
          {/* Public auth routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="verify-email" element={<VerifyEmail />} />

          {/* Student routes */}
          <Route path="/student" element={<StudentGuard><StudentLayout /></StudentGuard>}>
            <Route index element={withLazyPageBoundary('Dashboard', <StudentDashboard />)} />
            <Route path="dashboard" element={withLazyPageBoundary('Dashboard', <StudentDashboard />)} />
            <Route path="admission" element={withLazyPageBoundary('Admission', <StudentAdmission />)} />
            <Route path="track" element={withLazyPageBoundary('Track Application', <StudentApplicationTracker />)} />
            <Route path="exam" element={withLazyPageBoundary('Exam', <StudentExam />)} />
            <Route path="results" element={withLazyPageBoundary('Results', <StudentResults />)} />
            <Route path="profile" element={withLazyPageBoundary('Profile', <Profile />)} />
          </Route>

          {/* Employee routes */}
          <Route path="/employee" element={<EmployeeLayout />}>
            <Route index element={withLazyPageBoundary('Dashboard', <EmployeeDashboard />)} />
            <Route path="dashboard" element={withLazyPageBoundary('Dashboard', <EmployeeDashboard />)} />
            <Route path="admissions" element={<RoleGuard page="admissions">{withLazyPageBoundary('Admissions', <EmployeeAdmissions />)}</RoleGuard>} />
            <Route path="registrar-records" element={<RoleGuard page="admissions">{withLazyPageBoundary('Registrar Records', <EmployeeRegistrarRecords />)}</RoleGuard>} />
            <Route path="exams" element={<RoleGuard page="exams">{withLazyPageBoundary('Exams', <EmployeeExams />)}</RoleGuard>} />
            <Route path="exams/preview/:examId" element={<RoleGuard page="exams">{withLazyPageBoundary('Exam Preview', <ExamPreview />)}</RoleGuard>} />
            <Route path="results" element={<RoleGuard page="results">{withLazyPageBoundary('Results', <EmployeeResults />)}</RoleGuard>} />
            <Route path="reports" element={<RoleGuard page="reports">{withLazyPageBoundary('Reports', <EmployeeReports />)}</RoleGuard>} />
            <Route path="users" element={<RoleGuard page="users">{withLazyPageBoundary('Users', <EmployeeUsers />)}</RoleGuard>} />
            <Route path="audit" element={<RoleGuard page="audit">{withLazyPageBoundary('Audit Log', <EmployeeAuditLog />)}</RoleGuard>} />
            <Route path="settings" element={<RoleGuard page="settings">{withLazyPageBoundary('Settings', <EmployeeSettings />)}</RoleGuard>} />
            <Route path="profile" element={withLazyPageBoundary('Profile', <Profile />)} />
          </Route>

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Catch-all 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </FirstLoginGuard>
      </HashRouter>
      </ConfirmProvider>
        </SocketProvider>
      <ToastContainer />
    </AuthProvider>
    </ErrorBoundary>
  );
}
