import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { client, setToken, setAuthErrorHandler } from '../api/client.js';

const AuthContext = createContext(null);

/* ===== Role-Based Access Control ===== */
const ROLE_PERMISSIONS = {
  administrator: ['dashboard', 'admissions', 'exams', 'results', 'reports', 'users', 'audit', 'settings'],
  registrar:     ['dashboard', 'admissions', 'results', 'reports'],
  teacher:       ['dashboard', 'admissions', 'exams', 'results', 'reports'],
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
    setToken(null);
    setUser(null);
  }, []);

  // Register 401 auto-logout handler
  useEffect(() => {
    setAuthErrorHandler(() => logout());
  }, [logout]);

  const login = useCallback(async (email, password, opts = {}) => {
    try {
      // If registerPayload is provided, call /auth/register instead of /auth/login
      const res = opts.registerPayload
        ? await client.post('/auth/register', opts.registerPayload)
        : await client.post('/auth/login', { email, password });
      // Backend returns { user, token }
      setToken(res.token);
      localStorage.setItem('gk_current_user', JSON.stringify(res.user));
      localStorage.setItem('gk_user_hash', computeHash(res.user));
      setUser(res.user);
      return { ok: true, user: res.user };
    } catch (err) {
      return { ok: false, msg: err.message || 'Login failed.' };
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user) return;
    try {
      const res = await client.get('/auth/me');
      if (!res || res.status === 'Inactive') {
        logout();
        return;
      }
      localStorage.setItem('gk_current_user', JSON.stringify(res));
      localStorage.setItem('gk_user_hash', computeHash(res));
      setUser(res);
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
