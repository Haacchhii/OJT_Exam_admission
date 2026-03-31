import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from './ConfirmDialog';
import Icon from './Icons';
import { SCHOOL_BRAND, SCHOOL_SUBTITLE } from '../utils/constants';
import { prefetchRouteByPath } from '../utils/routePrefetch';

interface LinkItem {
  to: string;
  icon: string;
  label: string;
  end?: boolean;
  page?: string;
}

const studentLinks: LinkItem[] = [
  { to: '/student', icon: 'dashboard', label: 'Dashboard', end: true },
  { to: '/student/exam', icon: 'exam', label: 'Online Exam' },
  { to: '/student/admission', icon: 'admissions', label: 'My Admission' },
  { to: '/student/track', icon: 'search', label: 'Track Application' },
  { to: '/student/results', icon: 'trophy', label: 'My Results' },
];

const allEmployeeLinks: LinkItem[] = [
  { to: '/employee', icon: 'dashboard', label: 'Dashboard', end: true, page: 'dashboard' },
  { to: '/employee/admissions', icon: 'admissions', label: 'Admissions', page: 'admissions' },
  { to: '/employee/exams', icon: 'exam', label: 'Exams', page: 'exams' },
  { to: '/employee/results', icon: 'results', label: 'Results', page: 'results' },
  { to: '/employee/reports', icon: 'reports', label: 'Reports', page: 'reports' },
  { to: '/employee/users', icon: 'users', label: 'Users', page: 'users' },
  { to: '/employee/audit', icon: 'shieldCheck', label: 'Audit Log', page: 'audit' },
  { to: '/employee/settings', icon: 'cog', label: 'Settings', page: 'settings' },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  role: 'student' | 'employee';
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ open, onClose, role, collapsed, onToggleCollapse }: SidebarProps) {
  const { logout, canAccess, roleLabel } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const links = role === 'employee'
    ? allEmployeeLinks.filter(l => canAccess(l.page as any))
    : studentLinks;
  const isEmployee = role === 'employee';

  const roleBadgeText = isEmployee ? roleLabel : 'Student';
  const roleBadgeShort = isEmployee
    ? (roleLabel === 'Administrator' ? 'AD' : roleLabel === 'Registrar' ? 'RG' : roleLabel === 'Teacher' ? 'TC' : 'EM')
    : 'ST';

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity" onClick={onClose} />}

      <aside className={`fixed top-0 left-0 z-50 h-screen flex flex-col transition-all duration-300 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'lg:w-[72px]' : 'lg:w-[270px]'} w-[270px]`} role="navigation" aria-label="Main navigation">
        <div className="flex flex-col h-full bg-forest-800 border-r border-forest-700/50">

          {/* Brand */}
          <div className={`flex items-center gap-3 border-b border-forest-700/40 ${collapsed ? 'lg:justify-center lg:px-3 lg:py-5' : 'px-5 py-5'}`}>
            <div className="w-9 h-9 rounded-lg bg-forest-600 flex items-center justify-center shrink-0">
              <Icon name="key" className="w-4.5 h-4.5 text-gold-400" />
            </div>
            <div className={`transition-opacity duration-200 ${collapsed ? 'lg:hidden' : ''}`}>
              <h2 className="text-sm font-bold tracking-wide text-white leading-tight">{SCHOOL_BRAND}</h2>
              <p className="text-[11px] text-forest-300/70 font-normal mt-0.5">{SCHOOL_SUBTITLE}</p>
            </div>
          </div>

          {/* Role Badge */}
          <div className={`px-4 py-3 ${collapsed ? 'lg:flex lg:justify-center lg:px-2' : ''}`}>
            <span className={`inline-flex items-center text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-md bg-forest-700/60 text-forest-200 ${collapsed ? 'lg:px-1.5' : ''}`}>
              {collapsed ? roleBadgeShort : roleBadgeText}
            </span>
          </div>

          {/* Section label */}
          {!collapsed && (
            <div className="px-6 pt-1 pb-2">
              <span className="text-[11px] uppercase tracking-[0.15em] text-forest-500 font-medium">Navigation</span>
            </div>
          )}

          {/* Nav Links */}
          <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
            {links.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={onClose}
                onMouseEnter={() => prefetchRouteByPath(l.to)}
                onFocus={() => prefetchRouteByPath(l.to)}
                onTouchStart={() => prefetchRouteByPath(l.to)}
                title={collapsed ? l.label : undefined}
                aria-label={l.label}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 ${collapsed ? 'lg:justify-center lg:px-0' : ''} ${
                    isActive
                      ? 'bg-forest-600/50 text-white'
                      : 'text-forest-300 hover:bg-forest-700/50 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
                      isActive ? 'text-white' : 'text-forest-400 group-hover:text-forest-200'
                    }`}>
                      <Icon name={l.icon} className="w-[18px] h-[18px]" />
                    </div>
                    <span className={`${collapsed ? 'lg:hidden' : ''} ${isActive ? 'font-semibold' : 'font-normal'}`}>{l.label}</span>
                    {isActive && <span className="sr-only">(current page)</span>}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Collapse toggle */}
          <div className="hidden lg:flex justify-center py-2 border-t border-forest-700/40">
            <button onClick={onToggleCollapse} className="p-2 rounded-lg text-forest-400 hover:text-forest-200 hover:bg-forest-700/50 transition-colors duration-150" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} className="w-4 h-4" />
            </button>
          </div>

          {/* Footer */}
          <div className={`border-t border-forest-700/40 ${collapsed ? 'lg:flex lg:flex-col lg:items-center lg:p-3' : 'p-4'}`}>
            <button
              onClick={async () => {
                const ok = await confirm({ title: 'Log Out', message: 'Are you sure you want to log out?', confirmLabel: 'Log Out', variant: 'warning' });
                if (ok) { logout(); navigate('/login'); }
              }}
              className={`group flex items-center gap-2.5 text-sm w-full px-3 py-2 rounded-lg text-red-400/70 hover:text-red-300 hover:bg-red-500/10 transition-colors duration-150 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
              title={collapsed ? 'Logout' : undefined}
              aria-label="Log out"
            >
              <Icon name="logout" className="w-[18px] h-[18px] shrink-0" />
              <span className={`font-medium ${collapsed ? 'lg:hidden' : ''}`}>Log out</span>
            </button>
            <p className={`text-[11px] text-forest-600 mt-3 px-3 ${collapsed ? 'lg:hidden' : ''}`}>&copy; 2026 GKISSJ</p>
          </div>
        </div>
      </aside>
    </>
  );
}
