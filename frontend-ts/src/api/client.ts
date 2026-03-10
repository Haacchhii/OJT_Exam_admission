// ============================================
// client.ts — Typed HTTP client for backend API
// ============================================

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

// ---- Token management ----
let authToken: string | null = null;
try { authToken = localStorage.getItem('gk_auth_token'); } catch { /* SSR safe */ }

export function setToken(token: string | null): void {
  authToken = token;
  if (token) localStorage.setItem('gk_auth_token', token);
  else localStorage.removeItem('gk_auth_token');
}

export function getToken(): string | null { return authToken; }

// ---- Auto-logout on 401 ----
let onAuthError: (() => void) | null = null;
export function setAuthErrorHandler(handler: () => void): void { onAuthError = handler; }

// ---- Custom error class ----
export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// ---- Query string builder ----
export function qs(params: Record<string, any> = {}): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

// ---- Retry with exponential backoff ----
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRetryable = err instanceof ApiError && (err.status === 0 || RETRYABLE_STATUSES.has(err.status));
      if (!isRetryable || attempt >= retries) throw err;
      await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

// ---- Core request function ----
async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  { isFormData = false }: { isFormData?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: isFormData
        ? (body as BodyInit)
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
    });
  } catch {
    throw new ApiError('Network error. Please check your connection and try again.', 0);
  }

  if (res.status === 401) {
    setToken(null);
    if (onAuthError) onAuthError();
    throw new ApiError('Session expired. Please log in again.', 401);
  }

  if (res.status === 403) {
    throw new ApiError('You do not have permission to perform this action.', 403);
  }

  if (res.status === 404) {
    throw new ApiError('The requested resource was not found.', 404);
  }

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('json') ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in data ? (data as { message: string }).message
      : typeof data === 'object' && data !== null && 'error' in data ? (data as { error: string }).error
      : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, data);
  }

  return data as T;
}

// ---- Public client interface ----
export const client = {
  get:    <T = unknown>(path: string) => withRetry(() => request<T>('GET', path)),
  post:   <T = unknown>(path: string, body?: unknown) => request<T>('POST', path, body),
  put:    <T = unknown>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch:  <T = unknown>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T = unknown>(path: string) => request<T>('DELETE', path),
  upload: <T = unknown>(path: string, formData: FormData) => request<T>('POST', path, formData, { isFormData: true }),
};
