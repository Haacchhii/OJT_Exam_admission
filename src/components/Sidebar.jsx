import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfirm } from './ConfirmDialog.jsx';

const studentLinks = [
  { to: '/student', icon: '📊', label: 'Dashboard', end: true },
  { to: '/student/exam', icon: '📖', label: 'Online Exam' },
  { to: '/student/admission', icon: '📝', label: 'My Admission' },
  { to: '/student/results', icon: '🏆', label: 'My Results' },
];

const employeeLinks = [
  { to: '/employee', icon: '📊', label: 'Dashboard', end: true },
  { to: '/employee/admissions', icon: '📋', label: 'Admissions' },
  { to: '/employee/exams', icon: '📖', label: 'Exams' },
  { to: '/employee/results', icon: '🧮', label: 'Results' },
  { to: '/employee/reports', icon: '📤', label: 'Reports' },
  { to: '/employee/users', icon: '👥', label: 'Users' },
];

export default function Sidebar({ open, onClose, role, collapsed, onToggleCollapse }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const links = role === 'employee' ? employeeLinks : studentLinks;
  const roleBadge = role === 'employee'
    ? 'bg-forest-500 text-gold-300'
    : 'bg-gold-400 text-forest-600';

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed top-0 left-0 z-50 h-screen bg-gradient-to-b from-forest-500 to-forest-700 text-white flex flex-col transition-all duration-300 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'lg:w-16' : 'lg:w-64'} w-64`} role="navigation" aria-label="Main navigation">
        {/* Brand */}
        <div className="p-5 flex items-center gap-3 border-b border-white/10">
          <span className="text-2xl shrink-0">🔑</span>
          <h2 className={`text-lg font-bold tracking-tight transition-opacity duration-200 ${collapsed ? 'lg:hidden' : ''}`}>GKISSJ</h2>
        </div>

        {/* Role Badge */}
        <div className={`px-5 py-3 ${collapsed ? 'lg:flex lg:justify-center lg:px-2' : ''}`}>
          <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${roleBadge} ${collapsed ? 'lg:px-1.5 lg:text-[9px]' : ''}`}>
            {collapsed ? (role === 'employee' ? 'EM' : 'ST') : (role === 'employee' ? 'Employee' : 'Student')}
          </span>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={onClose}
              title={collapsed ? l.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${collapsed ? 'lg:justify-center lg:px-0' : ''} ${
                  isActive
                    ? 'bg-white/15 text-gold-300'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`
              }
              style={({ isActive }) => isActive ? { } : undefined}
              aria-current={undefined}
            >
              {({ isActive }) => (
                <>
                  <span className="text-lg shrink-0">{l.icon}</span>
                  <span className={collapsed ? 'lg:hidden' : ''}>{l.label}</span>
                  {isActive && <span className="sr-only">(current page)</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:flex justify-center py-2 border-t border-white/10">
          <button onClick={onToggleCollapse} className="text-gray-400 hover:text-white text-sm p-2 rounded-lg hover:bg-white/10 transition-colors" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? '▶' : '◀'}
          </button>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t border-white/10 space-y-2 ${collapsed ? 'lg:flex lg:flex-col lg:items-center lg:p-2' : ''}`}>
          <button
            onClick={async () => {
              const ok = await confirm({ title: 'Log Out', message: 'Are you sure you want to log out?', confirmLabel: 'Log Out', variant: 'warning' });
              if (ok) { logout(); navigate('/login'); }
            }}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-medium w-full"
            title={collapsed ? 'Logout' : undefined}
            aria-label="Log out"
          >
            🚪 <span className={collapsed ? 'lg:hidden' : ''}>Logout</span>
          </button>
          <p className={`text-xs text-gray-500 ${collapsed ? 'lg:hidden' : ''}`}>&copy; 2026 GOLDEN KEY Integrated School of St. Joseph</p>
        </div>
      </aside>
    </>
  );
}
