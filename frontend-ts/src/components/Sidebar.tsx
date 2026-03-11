import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from './ConfirmDialog';
import Icon from './Icons';

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
        <div className="sidebar-pattern flex flex-col h-full bg-gradient-to-b from-[#0a2e1a] via-[#0f3d22] to-forest-700 border-r border-gold-400/10">

          {/* Brand */}
          <div className={`flex items-center gap-3.5 border-b border-gold-400/10 ${collapsed ? 'lg:justify-center lg:px-3 lg:py-5' : 'px-5 py-5'}`}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-300 via-gold-400 to-gold-500 flex items-center justify-center shrink-0 shadow-gold ring-2 ring-gold-400/20">
              <Icon name="key" className="w-5 h-5 text-forest-900" />
            </div>
            <div className={`transition-opacity duration-200 ${collapsed ? 'lg:hidden' : ''}`}>
              <h2 className="text-sm tracking-wider leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                <span className="text-gold-400">GOLDEN KEY</span>
              </h2>
              <p className="text-[10px] text-forest-300/80 font-light tracking-wide" style={{ fontFamily: 'var(--font-body)' }}>Integrated School of St. Joseph</p>
            </div>
          </div>

          {/* Role Badge */}
          <div className={`px-4 py-3 ${collapsed ? 'lg:flex lg:justify-center lg:px-2' : ''}`}>
            <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full border ${collapsed ? 'lg:px-1.5' : ''}`}
              style={{ fontFamily: 'var(--font-body)', background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,215,0,0.05))', color: '#fcd34d', borderColor: 'rgba(255,215,0,0.15)' }}>
              {collapsed ? roleBadgeShort : roleBadgeText}
            </span>
          </div>

          {/* Section label */}
          {!collapsed && (
            <div className="px-6 pt-1 pb-2">
              <span className="text-[9px] uppercase tracking-[0.2em] text-forest-400/60 font-semibold" style={{ fontFamily: 'var(--font-body)' }}>Navigation</span>
            </div>
          )}

          {/* Nav Links */}
          <nav className="flex-1 px-3 space-y-1 overflow-y-auto animate-nav-items">
            {links.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={onClose}
                title={collapsed ? l.label : undefined}
                aria-label={l.label}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-200 ${collapsed ? 'lg:justify-center lg:px-0' : ''} ${
                    isActive
                      ? 'bg-gradient-to-r from-gold-400/15 to-transparent text-white border-l-[3px] border-gold-400 ml-0 pl-2.5'
                      : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border-l-[3px] border-transparent'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 shrink-0 ${
                      isActive ? 'bg-gold-400/20 text-gold-300 shadow-sm shadow-gold-400/10' : 'text-gray-500 group-hover:text-gray-300'
                    }`}>
                      <Icon name={l.icon} className="w-[18px] h-[18px]" />
                    </div>
                    <span className={`${collapsed ? 'lg:hidden' : ''} ${isActive ? 'font-semibold' : 'font-normal'}`}
                      style={{ fontFamily: 'var(--font-body)' }}>{l.label}</span>
                    {isActive && <span className="sr-only">(current page)</span>}
                    {isActive && !collapsed && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gold-400 lg:block hidden shadow-sm shadow-gold-400/50" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Collapse toggle */}
          <div className="hidden lg:flex justify-center py-2 border-t border-gold-400/8">
            <button onClick={onToggleCollapse} className="p-2 rounded-lg text-gray-500 hover:text-gold-300 hover:bg-white/5 transition-all duration-200" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} className="w-4 h-4" />
            </button>
          </div>

          {/* Footer */}
          <div className={`border-t border-gold-400/8 ${collapsed ? 'lg:flex lg:flex-col lg:items-center lg:p-3' : 'p-4'}`}>
            <button
              onClick={async () => {
                const ok = await confirm({ title: 'Log Out', message: 'Are you sure you want to log out?', confirmLabel: 'Log Out', variant: 'warning' });
                if (ok) { logout(); navigate('/login'); }
              }}
              className={`group flex items-center gap-2.5 text-sm w-full px-3 py-2 rounded-xl text-red-400/70 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
              title={collapsed ? 'Logout' : undefined}
              aria-label="Log out"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <Icon name="logout" className="w-[18px] h-[18px] shrink-0" />
              <span className={`font-medium ${collapsed ? 'lg:hidden' : ''}`}>Log out</span>
            </button>
            <p className={`text-[10px] text-forest-700 mt-3 px-3 ${collapsed ? 'lg:hidden' : ''}`} style={{ fontFamily: 'var(--font-body)' }}>&copy; 2026 GKISSJ</p>
          </div>
        </div>
      </aside>
    </>
  );
}
