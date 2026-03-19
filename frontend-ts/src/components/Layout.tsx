import { useState, useEffect } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Breadcrumbs from './Breadcrumbs';
import { KeyboardShortcutsProvider } from './KeyboardShortcuts';
import { showToast } from './Toast';

const SIDEBAR_KEY = 'gk_sidebar_collapsed';
function useSidebarCollapsed(): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === 'true'; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem(SIDEBAR_KEY, String(collapsed)); } catch { /* ignore */ } }, [collapsed]);
  return [collapsed, setCollapsed];
}

export function StudentLayout() {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  useEffect(() => {
    if (!socket || !isConnected) return;
    const handleAdmissionStatus = (payload: { status?: string; trackingId?: string }) => {
      const statusLabel = payload?.status || 'updated';
      const trackingLabel = payload?.trackingId ? ` (${payload.trackingId})` : '';
      showToast(`Admission status ${statusLabel}${trackingLabel}. Check Track Application for details.`, 'info');
    };
    socket.on('admission_status_updated', handleAdmissionStatus);
    return () => {
      socket.off('admission_status_updated', handleAdmissionStatus);
    };
  }, [socket, isConnected]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'applicant') return <Navigate to="/employee" replace />;

  return (
    <KeyboardShortcutsProvider navigate={navigate} role={user.role}>
      <div className="min-h-screen gk-mesh-bg">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-forest-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg">Skip to main content</a>
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} role="student" collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />
        <div className={`transition-all duration-300 ${collapsed ? 'lg:ml-[72px]' : 'lg:ml-[270px]'}`}>
          <Topbar title="Student Portal" onMenuToggle={() => setSidebarOpen(o => !o)} userId={user.id} user={user} />
          <main id="main-content" className="pt-20 pb-10 px-4 sm:px-6 lg:px-8" role="main" aria-label="Student portal content">
            <Breadcrumbs />
            <div className="w-full mx-auto max-w-screen-2xl">
              <Outlet />
            </div>
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

  const ROLE_TITLE: Record<string, string> = {
    administrator: 'Admin Portal',
    registrar: 'Registrar Portal',
    teacher: 'Teacher Portal',
  };
  const portalTitle = ROLE_TITLE[user.role] || 'Employee Portal';

  return (
    <KeyboardShortcutsProvider navigate={navigate} role={user.role}>
      <div className="min-h-screen gk-mesh-bg">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-forest-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg">Skip to main content</a>
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} role="employee" collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />
        <div className={`transition-all duration-300 ${collapsed ? 'lg:ml-[72px]' : 'lg:ml-[270px]'}`}>
          <Topbar title={portalTitle} onMenuToggle={() => setSidebarOpen(o => !o)} userId={user.id} user={user} />
          <main id="main-content" className="pt-20 pb-10 px-4 sm:px-6 lg:px-8" role="main" aria-label="Employee portal content">
            <Breadcrumbs />
            <div className="w-full mx-auto max-w-screen-2xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </KeyboardShortcutsProvider>
  );
}
