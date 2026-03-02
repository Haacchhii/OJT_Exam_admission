import { createContext, useContext, useState, useCallback } from 'react';
import { getUserByEmail } from '../api/users.js';

const AuthContext = createContext(null);

/* ===== Role-Based Access Control ===== */
const ROLE_PERMISSIONS = {
  administrator: ['dashboard', 'admissions', 'exams', 'results', 'reports', 'users'],
  registrar:     ['dashboard', 'admissions', 'results', 'reports'],
  teacher:       ['dashboard', 'exams', 'results', 'reports'],
};

const ROLE_LABELS = {
  administrator: 'Administrator',
  registrar: 'Registrar',
  teacher: 'Teacher',
  applicant: 'Student',
};

export { ROLE_PERMISSIONS, ROLE_LABELS };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('gk_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const login = (email, password) => {
    const u = getUserByEmail(email);
    if (!u) return { ok: false, msg: 'No account found with that email.' };
    if (u.password !== password) return { ok: false, msg: 'Invalid email or password.' };
    if (u.status === 'Inactive') return { ok: false, msg: 'Your account has been deactivated. Please contact an administrator.' };
    const { password: _, ...safeUser } = u;
    localStorage.setItem('gk_current_user', JSON.stringify(safeUser));
    setUser(safeUser);
    return { ok: true, user: safeUser };
  };

  const logout = () => {
    localStorage.removeItem('gk_current_user');
    setUser(null);
  };

  const refreshUser = () => {
    if (!user) return;
    const u = getUserByEmail(user.email);
    if (!u || u.status === 'Inactive') {
      // User deleted or deactivated — force logout
      localStorage.removeItem('gk_current_user');
      setUser(null);
      return;
    }
    const { password: _, ...safeUser } = u;
    localStorage.setItem('gk_current_user', JSON.stringify(safeUser));
    setUser(safeUser);
  };

  const isEmployee = user && user.role !== 'applicant';

  const canAccess = useCallback((page) => {
    if (!user || user.role === 'applicant') return false;
    const perms = ROLE_PERMISSIONS[user.role];
    return perms ? perms.includes(page) : false;
  }, [user]);

  const roleLabel = ROLE_LABELS[user?.role] || user?.role || '';

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, isEmployee, canAccess, roleLabel }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
