import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { getUserByEmail } from '../api/users.js';
import { USE_API, client, setToken, setAuthErrorHandler } from '../api/client.js';

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

/* Simple integrity hash to detect localStorage tampering */
function computeHash(user) {
  const raw = `${user.id}:${user.email}:${user.role}:gk_salt_2026`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

export { ROLE_PERMISSIONS, ROLE_LABELS };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('gk_current_user');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // Verify integrity
      const storedHash = localStorage.getItem('gk_user_hash');
      if (storedHash && computeHash(parsed) !== storedHash) {
        localStorage.removeItem('gk_current_user');
        localStorage.removeItem('gk_user_hash');
        return null;
      }
      return parsed;
    } catch { return null; }
  });

  const logout = useCallback(() => {
    localStorage.removeItem('gk_current_user');
    localStorage.removeItem('gk_user_hash');
    if (USE_API) setToken(null);
    setUser(null);
  }, []);

  // Register 401 auto-logout handler
  useEffect(() => {
    setAuthErrorHandler(() => logout());
  }, [logout]);

  const login = useCallback(async (email, password) => {
    if (USE_API) {
      try {
        const res = await client.post('/auth/login', { email, password });
        // Backend returns { user, token }
        setToken(res.token);
        localStorage.setItem('gk_current_user', JSON.stringify(res.user));
        localStorage.setItem('gk_user_hash', computeHash(res.user));
        setUser(res.user);
        return { ok: true, user: res.user };
      } catch (err) {
        return { ok: false, msg: err.message || 'Login failed.' };
      }
    }
    // localStorage mode
    const u = await getUserByEmail(email);
    if (!u) return { ok: false, msg: 'No account found with that email.' };
    if (u.password !== password) return { ok: false, msg: 'Invalid email or password.' };
    if (u.status === 'Inactive') return { ok: false, msg: 'Your account has been deactivated. Please contact an administrator.' };
    const { password: _, ...safeUser } = u;
    localStorage.setItem('gk_current_user', JSON.stringify(safeUser));
    localStorage.setItem('gk_user_hash', computeHash(safeUser));
    setUser(safeUser);
    return { ok: true, user: safeUser };
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user) return;
    try {
      const u = await getUserByEmail(user.email);
      if (!u || u.status === 'Inactive') {
        logout();
        return;
      }
      const { password: _, ...safeUser } = u;
      localStorage.setItem('gk_current_user', JSON.stringify(safeUser));
      localStorage.setItem('gk_user_hash', computeHash(safeUser));
      setUser(safeUser);
    } catch {
      // Network error during refresh — keep current session
    }
  }, [user, logout]);

  const isEmployee = user && user.role !== 'applicant';

  const canAccess = useCallback((page) => {
    if (!user || user.role === 'applicant') return false;
    const perms = ROLE_PERMISSIONS[user.role];
    return perms ? perms.includes(page) : false;
  }, [user]);

  const roleLabel = ROLE_LABELS[user?.role] || user?.role || '';

  const value = useMemo(() => ({
    user, login, logout, refreshUser, isEmployee, canAccess, roleLabel
  }), [user, login, logout, refreshUser, isEmployee, canAccess, roleLabel]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
