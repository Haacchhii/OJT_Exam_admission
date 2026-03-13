import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { client, setToken, setAuthErrorHandler } from '../api/client';
import type { User, UserRole, AuthResponse } from '../types';

/* ===== Role-Based Access Control ===== */
type Permission =
  | 'dashboard'
  | 'admissions'
  | 'exams'
  | 'results'
  | 'reports'
  | 'users'
  | 'audit'
  | 'settings';

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  administrator: ['dashboard', 'admissions', 'exams', 'results', 'reports', 'users', 'audit', 'settings'],
  registrar: ['dashboard', 'admissions', 'exams', 'results', 'reports'],
  teacher: ['dashboard', 'admissions', 'exams', 'results', 'reports'],
};

const ROLE_LABELS: Record<string, string> = {
  administrator: 'Administrator',
  registrar: 'Registrar',
  teacher: 'Teacher',
  applicant: 'Student',
};

function computeHash(user: User): string {
  const raw = `${user.id}:${user.email}:${user.role}:gk_salt_2026`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

export { ROLE_PERMISSIONS, ROLE_LABELS };
export type { Permission };

interface LoginResult {
  ok: boolean;
  user?: User;
  msg?: string;
}

interface LoginOpts {
  registerPayload?: Record<string, unknown>;
}

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string, opts?: LoginOpts) => Promise<LoginResult>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isEmployee: boolean;
  canAccess: (page: Permission) => boolean;
  roleLabel: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('gk_current_user');
      if (!saved) return null;
      const parsed = JSON.parse(saved) as User;
      const storedHash = localStorage.getItem('gk_user_hash');
      if (storedHash && computeHash(parsed) !== storedHash) {
        localStorage.removeItem('gk_current_user');
        localStorage.removeItem('gk_user_hash');
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const logout = useCallback(() => {
    localStorage.removeItem('gk_current_user');
    localStorage.removeItem('gk_user_hash');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setAuthErrorHandler(() => logout());
  }, [logout]);

  const login = useCallback(async (email: string, password: string, opts: LoginOpts = {}): Promise<LoginResult> => {
    try {
      const res = opts.registerPayload
        ? await client.post<AuthResponse>('/auth/register', opts.registerPayload)
        : await client.post<AuthResponse>('/auth/login', { email, password });
      if (!res?.user || !res?.token) {
        throw new Error(`API misconfiguration: expected {user,token} but got ${typeof res === 'string' ? 'HTML page' : JSON.stringify(res)?.slice(0, 80)}. Check VITE_API_URL.`);
      }
      setToken(res.token);
      localStorage.setItem('gk_current_user', JSON.stringify(res.user));
      localStorage.setItem('gk_user_hash', computeHash(res.user));
      setUser(res.user);
      return { ok: true, user: res.user };
    } catch (err) {
      return { ok: false, msg: (err as Error).message || 'Login failed.' };
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user) return;
    try {
      const res = await client.get<User & { status?: string }>('/auth/me');
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

  const isEmployee = !!user && user.role !== 'applicant';

  const canAccess = useCallback(
    (page: Permission): boolean => {
      if (!user || user.role === 'applicant') return false;
      const perms = ROLE_PERMISSIONS[user.role];
      return perms ? perms.includes(page) : false;
    },
    [user]
  );

  const roleLabel = ROLE_LABELS[user?.role as string] || user?.role || '';

  // Session inactivity timeout — logout after 30 minutes of no interaction
  useEffect(() => {
    if (!user) return;
    const INACTIVITY_MS = 30 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { logout(); }, INACTIVITY_MS);
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach(e => window.addEventListener(e, reset));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [user, logout]);

  // Periodically validate session with backend (every 5 min)
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => { refreshUser(); }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [user, refreshUser]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, login, logout, refreshUser, isEmployee, canAccess, roleLabel }),
    [user, login, logout, refreshUser, isEmployee, canAccess, roleLabel]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
