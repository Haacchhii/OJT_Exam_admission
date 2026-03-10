import { useState, useEffect } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import Breadcrumbs from './Breadcrumbs.jsx';
import { KeyboardShortcutsProvider } from './KeyboardShortcuts.jsx';

const SIDEBAR_KEY = 'gk_sidebar_collapsed';
function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === 'true'; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem(SIDEBAR_KEY, String(collapsed)); } catch {} }, [collapsed]);
  return [collapsed, setCollapsed];
}

export function StudentLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'applicant') return <Navigate to="/employee" replace />;

  return (
    <KeyboardShortcutsProvider navigate={navigate} role={user.role}>
    <div className="min-h-screen bg-gray-50">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-forest-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg">Skip to main content</a>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} role="student" collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />
      <div className={`transition-all duration-300 ${collapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <Topbar title="Student Portal" onMenuToggle={() => setSidebarOpen(o => !o)} userId={user.id} user={user} />
        <main id="main-content" className="p-4 lg:p-6" role="main" aria-label="Student portal content">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
    </div>
    </KeyboardShortcutsProvider>
  );
}

export function EmployeeLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'applicant') return <Navigate to="/student" replace />;

  const ROLE_TITLE = {
    administrator: 'Admin Portal',
    registrar: 'Registrar Portal',
    teacher: 'Teacher Portal',
  };
  const portalTitle = ROLE_TITLE[user.role] || 'Employee Portal';

  return (
    <KeyboardShortcutsProvider navigate={navigate} role={user.role}>
    <div className="min-h-screen bg-gray-50">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-forest-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg">Skip to main content</a>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} role="employee" collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />
      <div className={`transition-all duration-300 ${collapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <Topbar title={portalTitle} onMenuToggle={() => setSidebarOpen(o => !o)} userId={user.id} user={user} />
        <main id="main-content" className="p-4 lg:p-6" role="main" aria-label="Employee portal content">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
    </div>
    </KeyboardShortcutsProvider>
  );
}
