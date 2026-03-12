import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfirm } from './ConfirmDialog.jsx';
import Icon from './Icons.jsx';
import { SCHOOL_NAME_SHORT, SCHOOL_NAME_SUBTITLE } from '../utils/constants';

const studentLinks = [
  { to: '/student', icon: 'dashboard', label: 'Dashboard', end: true },
  { to: '/student/exam', icon: 'exam', label: 'Online Exam' },
  { to: '/student/admission', icon: 'admissions', label: 'My Admission' },
  { to: '/student/results', icon: 'trophy', label: 'My Results' },
];

const allEmployeeLinks = [
  { to: '/employee', icon: 'dashboard', label: 'Dashboard', end: true, page: 'dashboard' },
  { to: '/employee/admissions', icon: 'admissions', label: 'Admissions', page: 'admissions' },
  { to: '/employee/exams', icon: 'exam', label: 'Exams', page: 'exams' },
  { to: '/employee/results', icon: 'results', label: 'Results', page: 'results' },
  { to: '/employee/reports', icon: 'reports', label: 'Reports', page: 'reports' },
  { to: '/employee/users', icon: 'users', label: 'Users', page: 'users' },
  { to: '/employee/audit', icon: 'shieldCheck', label: 'Audit Log', page: 'audit' },
  { to: '/employee/settings', icon: 'cog', label: 'Settings', page: 'settings' },
];

export default function Sidebar({ open, onClose, role, collapsed, onToggleCollapse }) {
  const { logout, canAccess, roleLabel } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const links = role === 'employee'
    ? allEmployeeLinks.filter(l => canAccess(l.page))
    : studentLinks;
  const isEmployee = role === 'employee';

  const roleBadge = isEmployee
    ? 'bg-gold-400/15 text-gold-300 border border-gold-400/20'
    : 'bg-gold-400/20 text-gold-300 border border-gold-400/25';
  const roleBadgeText = isEmployee ? roleLabel : 'Student';
  const roleBadgeShort = isEmployee
    ? (roleLabel === 'Administrator' ? 'AD' : roleLabel === 'Registrar' ? 'RG' : roleLabel === 'Teacher' ? 'TC' : 'EM')
    : 'ST';

  return (
    <>
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity" onClick={onClose} />}

      <aside className={`fixed top-0 left-0 z-50 h-screen flex flex-col transition-all duration-300 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'lg:w-[72px]' : 'lg:w-[260px]'} w-[260px]`} role="navigation" aria-label="Main navigation">

        {/* Sidebar inner with glass effect */}
        <div className="flex flex-col h-full bg-gradient-to-b from-[#0f3d22] via-forest-600 to-forest-700 border-r border-white/5">

          {/* Brand */}
          <div className={`flex items-center gap-3 border-b border-white/8 ${collapsed ? 'lg:justify-center lg:px-3 lg:py-5' : 'px-5 py-5'}`}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center shrink-0 shadow-gold">
              <Icon name="key" className="w-5 h-5 text-forest-800" />
            </div>
            <div className={`transition-opacity duration-200 ${collapsed ? 'lg:hidden' : ''}`}>
              <h2 className="text-sm font-bold tracking-tight leading-tight"><span className="text-gold-400">{SCHOOL_NAME_SHORT}</span></h2>
              <p className="text-[10px] text-forest-300 font-medium">{SCHOOL_NAME_SUBTITLE}</p>
            </div>
          </div>

          {/* Role Badge */}
          <div className={`px-4 py-3 ${collapsed ? 'lg:flex lg:justify-center lg:px-2' : ''}`}>
            <span className={`inline-flex items-center text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg ${roleBadge} ${collapsed ? 'lg:px-1.5' : ''}`}>
              {collapsed ? roleBadgeShort : roleBadgeText}
            </span>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
            {links.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={onClose}
                title={collapsed ? l.label : undefined}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${collapsed ? 'lg:justify-center lg:px-0' : ''} ${
                    isActive
                      ? 'bg-white/12 text-white shadow-sm'
                      : 'text-gray-400 hover:bg-white/6 hover:text-gray-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 shrink-0 ${
                      isActive
                        ? 'bg-gold-400/20 text-gold-300'
                        : 'text-gray-400 group-hover:text-gray-300'
                    }`}>
                      <Icon name={l.icon} className="w-[18px] h-[18px]" />
                    </div>
                    <span className={collapsed ? 'lg:hidden' : ''}>{l.label}</span>
                    {isActive && <span className="sr-only">(current page)</span>}
                    {isActive && !collapsed && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gold-400 lg:block hidden" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Collapse toggle (desktop only) */}
          <div className="hidden lg:flex justify-center py-2 border-t border-white/8">
            <button onClick={onToggleCollapse} className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/6 transition-all duration-200" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} className="w-4 h-4" />
            </button>
          </div>

          {/* Footer */}
          <div className={`border-t border-white/8 ${collapsed ? 'lg:flex lg:flex-col lg:items-center lg:p-3' : 'p-4'}`}>
            <button
              onClick={async () => {
                const ok = await confirm({ title: 'Log Out', message: 'Are you sure you want to log out?', confirmLabel: 'Log Out', variant: 'warning' });
                if (ok) { logout(); navigate('/login'); }
              }}
              className={`group flex items-center gap-2.5 text-sm font-medium w-full px-3 py-2 rounded-xl text-red-400/80 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
              title={collapsed ? 'Logout' : undefined}
              aria-label="Log out"
            >
              <Icon name="logout" className="w-[18px] h-[18px] shrink-0" />
              <span className={collapsed ? 'lg:hidden' : ''}>Log out</span>
            </button>
            <p className={`text-[10px] text-gray-600 mt-3 px-3 ${collapsed ? 'lg:hidden' : ''}`}>&copy; {new Date().getFullYear()} GKISSJ</p>
          </div>
        </div>
      </aside>
    </>
  );
}
