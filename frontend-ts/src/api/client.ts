// ============================================
// client.ts — Typed HTTP client for backend API
// ============================================

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

// ---- Token management ----
let authToken: string | null = null;
try {
  authToken = sessionStorage.getItem('gk_auth_token');
  // Remove legacy persistent token to enforce browser-close logout by default.
  localStorage.removeItem('gk_auth_token');
} catch {
  /* SSR safe */
}

export function setToken(token: string | null): void {
  authToken = token;
  try {
    if (token) sessionStorage.setItem('gk_auth_token', token);
    else sessionStorage.removeItem('gk_auth_token');
    localStorage.removeItem('gk_auth_token');
  } catch {
    // Ignore storage access issues and keep in-memory token.
  }
  invalidateGetCache();
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

function extractErrorMessage(data: unknown): string {
  if (data == null) return '';
  if (typeof data === 'string') return data;
  if (typeof data !== 'object') return '';

  const obj = data as {
    message?: unknown;
    error?: unknown;
    errors?: Array<{ path?: unknown; message?: unknown } | string>;
  };

  if (typeof obj.message === 'string' && obj.message.trim()) return obj.message;
  if (typeof obj.error === 'string' && obj.error.trim()) return obj.error;

  if (Array.isArray(obj.errors)) {
    const fields = obj.errors
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (!entry || typeof entry !== 'object') return '';
        const message = typeof entry.message === 'string' ? entry.message : '';
        const path = typeof entry.path === 'string' ? entry.path : '';
        if (!message.trim()) return '';
        return path.trim() ? `${path}: ${message}` : message;
      })
      .filter(Boolean)
      .join('; ');
    if (fields) return fields;
  }

  return '';
}

async function parseResponseBody(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('json')) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  try {
    return await res.text();
  } catch {
    return null;
  }
}

function withSupportHint(message: string): string {
  const clean = String(message || '').trim();
  const hint = 'If this keeps happening, please contact the developers or support team.';
  if (!clean) return hint;
  if (clean.toLowerCase().includes('contact the developers')) return clean;
  if (clean.toLowerCase().includes('support team')) return clean;
  return `${clean} ${hint}`;
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
const GET_BURST_CACHE_MS = 15000;
let cacheEpoch = 0;

const inflightGetRequests = new Map<string, Promise<unknown>>();
const recentGetResponses = new Map<string, { data: unknown; expiresAt: number; epoch: number }>();

export type RequestOptions = {
  signal?: AbortSignal;
};

function getPathFromKey(key: string): string {
  const sep = key.indexOf('::');
  return sep >= 0 ? key.slice(sep + 2) : key;
}

function invalidateGetCache(prefixes?: string[]) {
  cacheEpoch += 1;
  if (!prefixes || prefixes.length === 0) {
    inflightGetRequests.clear();
    recentGetResponses.clear();
  } else {
    for (const key of inflightGetRequests.keys()) {
      const path = getPathFromKey(key);
      if (prefixes.some(prefix => path.startsWith(prefix))) {
        inflightGetRequests.delete(key);
      }
    }
    for (const key of recentGetResponses.keys()) {
      const path = getPathFromKey(key);
      if (prefixes.some(prefix => path.startsWith(prefix))) {
        recentGetResponses.delete(key);
      }
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('gk:data-changed'));
    window.dispatchEvent(new CustomEvent('gk:data-changed-scoped', {
      detail: { prefixes: prefixes && prefixes.length > 0 ? prefixes : undefined },
    }));
  }
}

export function invalidateResourceCache(prefixes?: string[]) {
  invalidateGetCache(prefixes);
}

function emitRequestTiming(path: string, method: string, durationMs: number, status: number, fromCache = false): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gk:request-timing', {
      detail: { path, method, durationMs, status, fromCache },
    }));
  }
  if (import.meta.env.DEV) {
    const source = fromCache ? 'cache' : 'network';
    console.debug(`[api:${source}] ${method} ${path} ${status} ${durationMs.toFixed(1)}ms`);
  }
}

function makeRequestKey(path: string): string {
  return `${authToken || 'anon'}::${path}`;
}

function clearExpiredGetCache() {
  const now = Date.now();
  for (const [key, cached] of recentGetResponses.entries()) {
    if (cached.expiresAt <= now) recentGetResponses.delete(key);
  }
}

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
  { isFormData = false, signal }: { isFormData?: boolean; signal?: AbortSignal } = {}
): Promise<T> {
  const startedAt = performance.now();
  const headers: Record<string, string> = {};
  if (!isFormData) headers['Content-Type'] = 'application/json';
  const usingAuthToken = !!authToken;
  if (usingAuthToken) headers['Authorization'] = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      signal,
      body: isFormData
        ? (body as BodyInit)
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('Request cancelled', -1);
    }
    throw new ApiError('Network error. Please check your connection and try again.', 0);
  }

  const data = await parseResponseBody(res);
  const serverMessage = extractErrorMessage(data);

  if (res.status === 401) {
    if (usingAuthToken) {
      setToken(null);
      if (onAuthError) onAuthError();
    }
    throw new ApiError(
      serverMessage || (usingAuthToken
        ? 'Your session has expired. Please log in again.'
        : 'Unauthorized request.'),
      401,
      data
    );
  }

  if (res.status === 403) {
    const message = serverMessage || 'You do not have permission to perform this action.';
    throw new ApiError(message, 403, data);
  }

  if (res.status === 404) {
    const message = serverMessage || 'The requested resource was not found.';
    throw new ApiError(message, 404, data);
  }

  if (!res.ok) {
    const message = res.status >= 500
      ? withSupportHint(serverMessage || 'Something went wrong on our side. Please try again in a moment.')
      : (serverMessage || `Request failed (${res.status})`);
    throw new ApiError(message, res.status, data);
  }

  const elapsedMs = performance.now() - startedAt;
  emitRequestTiming(path, method, elapsedMs, res.status, false);

  return data as T;
}

// ---- Public client interface ----
export const client = {
  get:    <T = unknown>(path: string, options?: RequestOptions) => {
    clearExpiredGetCache();

    // If this request is caller-cancellable, do not dedupe it with shared in-flight requests.
    // This avoids accidental cross-cancellation between unrelated UI interactions.
    if (options?.signal) {
      return withRetry(() => request<T>('GET', path, undefined, { signal: options.signal }));
    }

    const key = makeRequestKey(path);
    const cached = recentGetResponses.get(key);
    if (cached && cached.expiresAt > Date.now() && cached.epoch === cacheEpoch) {
      emitRequestTiming(path, 'GET', 0, 200, true);
      return Promise.resolve(cached.data as T);
    }

    const inFlight = inflightGetRequests.get(key);
    if (inFlight) return inFlight as Promise<T>;

    const requestEpoch = cacheEpoch;
    const req = withRetry(() => request<T>('GET', path))
      .then(async (data) => {
        // If a mutation invalidated caches while this GET was in-flight,
        // fetch once more so callers do not receive a stale snapshot.
        if (requestEpoch !== cacheEpoch) {
          const freshRequestEpoch = cacheEpoch;
          const freshData = await withRetry(() => request<T>('GET', path));
          if (freshRequestEpoch === cacheEpoch) {
            recentGetResponses.set(key, {
              data: freshData,
              expiresAt: Date.now() + GET_BURST_CACHE_MS,
              epoch: freshRequestEpoch,
            });
          }
          return freshData;
        }

        recentGetResponses.set(key, {
          data,
          expiresAt: Date.now() + GET_BURST_CACHE_MS,
          epoch: requestEpoch,
        });
        return data;
      })
      .finally(() => {
        inflightGetRequests.delete(key);
      });

    inflightGetRequests.set(key, req as Promise<unknown>);
    return req;
  },
  post:   <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, body, { signal: options?.signal }).then((data) => { invalidateGetCache(); return data; }),
  put:    <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', path, body, { signal: options?.signal }).then((data) => { invalidateGetCache(); return data; }),
  patch:  <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PATCH', path, body, { signal: options?.signal }).then((data) => { invalidateGetCache(); return data; }),
  delete: <T = unknown>(path: string, options?: RequestOptions) => request<T>('DELETE', path, undefined, { signal: options?.signal }).then((data) => { invalidateGetCache(); return data; }),
  upload: <T = unknown>(path: string, formData: FormData, options?: RequestOptions) => request<T>('POST', path, formData, { isFormData: true, signal: options?.signal }).then((data) => { invalidateGetCache(); return data; }),
};

// Utility for filter/search UIs: cancel prior request before issuing the next one.
export function createRequestCanceller() {
  let controller: AbortController | null = null;

  return {
    nextSignal(): AbortSignal {
      if (controller) controller.abort();
      controller = new AbortController();
      return controller.signal;
    },
    cancel(): void {
      if (controller) controller.abort();
      controller = null;
    },
  };
}
