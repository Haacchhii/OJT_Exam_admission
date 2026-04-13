import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { client, setToken, setAuthErrorHandler, ApiError } from '../api/client';
import type { User, UserRole, AuthResponse } from '../types';

const USER_KEY = 'gk_current_user';
const USER_HASH_KEY = 'gk_user_hash';

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
  // Registrar: admission operations and reporting
  registrar: ['dashboard', 'admissions', 'results', 'reports'],
  // Teacher: exam operations, scoring, and reporting
  teacher: ['dashboard', 'exams', 'results', 'reports'],
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
  emailVerificationRequired?: boolean;
}

interface LoginOpts {
  registerPayload?: Record<string, unknown>;
}

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
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
      const saved = sessionStorage.getItem(USER_KEY);
      if (!saved) return null;
      const parsed = JSON.parse(saved) as User;
      const storedHash = sessionStorage.getItem(USER_HASH_KEY);
      if (storedHash && computeHash(parsed) !== storedHash) {
        sessionStorage.removeItem(USER_KEY);
        sessionStorage.removeItem(USER_HASH_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [authReady, setAuthReady] = useState<boolean>(() => user == null);

  const logout = useCallback(() => {
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_HASH_KEY);
    // Clear legacy persistent auth values from older builds.
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(USER_HASH_KEY);
    setToken(null);
    setUser(null);
    setAuthReady(true);
  }, []);

  useEffect(() => {
    let active = true;

    async function validateStartupSession() {
      // Enforce browser-close logout by clearing legacy persistent auth values.
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(USER_HASH_KEY);

      if (!user) {
        if (active) setAuthReady(true);
        return;
      }

      try {
        const res = await client.get<User & { status?: string }>('/auth/me');
        if (!res || res.status === 'Inactive') {
          logout();
          return;
        }
        sessionStorage.setItem(USER_KEY, JSON.stringify(res));
        sessionStorage.setItem(USER_HASH_KEY, computeHash(res));
        setUser(res);
      } catch (err) {
        // Keep current session on network-only failures while offline.
        if (!(err instanceof ApiError) || err.status !== 0) {
          logout();
        }
      } finally {
        if (active) setAuthReady(true);
      }
    }

    validateStartupSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setAuthErrorHandler(() => logout());
  }, [logout]);

  const login = useCallback(async (email: string, password: string, opts: LoginOpts = {}): Promise<LoginResult> => {
    try {
      const res = opts.registerPayload
        ? await client.post<AuthResponse>('/auth/register', opts.registerPayload)
        : await client.post<AuthResponse>('/auth/login', { email, password });
      if (res.emailVerificationRequired) {
        setToken(null);
        sessionStorage.removeItem(USER_KEY);
        sessionStorage.removeItem(USER_HASH_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(USER_HASH_KEY);
        setUser(null);
        return {
          ok: false,
          emailVerificationRequired: true,
          msg: res.msg || 'Please verify your email before signing in.',
        };
      }
      if (!res?.user || !res?.token) {
        throw new Error(`API misconfiguration: expected {user,token} but got ${typeof res === 'string' ? 'HTML page' : JSON.stringify(res)?.slice(0, 80)}. Check VITE_API_URL.`);
      }

      setToken(res.token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(res.user));
      sessionStorage.setItem(USER_HASH_KEY, computeHash(res.user));
      setUser(res.user);
      setAuthReady(true);
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
      sessionStorage.setItem(USER_KEY, JSON.stringify(res));
      sessionStorage.setItem(USER_HASH_KEY, computeHash(res));
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

  // Session inactivity timeout — logout after 60 minutes of no interaction
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
    () => ({ user, authReady, login, logout, refreshUser, isEmployee, canAccess, roleLabel }),
    [user, authReady, login, logout, refreshUser, isEmployee, canAccess, roleLabel]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
