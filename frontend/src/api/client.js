// ============================================
// client.js — HTTP client for backend API
// ============================================
// All API modules use this client to communicate with the backend.
// Set VITE_API_URL in .env to point to the backend (e.g. /api).

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

// ---- Token management ----
let authToken = null;
try { authToken = localStorage.getItem('gk_auth_token'); } catch { /* SSR safe */ }

export function setToken(token) {
  authToken = token;
  if (token) localStorage.setItem('gk_auth_token', token);
  else localStorage.removeItem('gk_auth_token');
}

export function getToken() { return authToken; }

// ---- Auto-logout on 401 ----
let onAuthError = null;
export function setAuthErrorHandler(handler) { onAuthError = handler; }

// ---- Custom error class ----
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function extractErrorMessage(data) {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (typeof data !== 'object') return '';

  if (typeof data.message === 'string' && data.message.trim()) return data.message;
  if (typeof data.error === 'string' && data.error.trim()) return data.error;

  if (Array.isArray(data.errors)) {
    const fields = data.errors
      .map((e) => {
        if (!e) return '';
        if (typeof e === 'string') return e;
        if (typeof e.message === 'string' && e.message.trim()) {
          if (typeof e.path === 'string' && e.path.trim()) return `${e.path}: ${e.message}`;
          return e.message;
        }
        return '';
      })
      .filter(Boolean)
      .join('; ');
    if (fields) return fields;
  }

  return '';
}

async function parseResponseBody(res) {
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

// ---- Query string builder ----
/**
 * Build a query string from an object, omitting null/undefined/empty values.
 * @param {Record<string, any>} params
 * @returns {string} e.g. "?page=1&limit=10&status=Accepted" or "" if no params
 */
export function qs(params = {}) {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + new URLSearchParams(entries).toString();
}

// ---- Core request function ----
async function request(method, path, body, { isFormData = false, signal } = {}) {
  const headers = {};
  if (!isFormData) headers['Content-Type'] = 'application/json';
  const usingAuthToken = !!authToken;
  if (usingAuthToken) headers['Authorization'] = `Bearer ${authToken}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      signal,
      body: isFormData ? body
        : body !== undefined ? JSON.stringify(body)
        : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Network error. Please check your connection and try again.', 0);
  }

  const data = await parseResponseBody(res);
  const serverMessage = extractErrorMessage(data);

  // 401 — only auto-logout when a token-authenticated request fails
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

  // 403 — forbidden
  if (res.status === 403) {
    throw new ApiError(serverMessage || 'You do not have permission to perform this action.', 403, data);
  }

  // 404 — not found
  if (res.status === 404) {
    throw new ApiError(serverMessage || 'The requested resource was not found.', 404, data);
  }

  // Any other non-2xx error
  if (!res.ok) {
    const message = serverMessage || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, data);
  }

  return data;
}

// ---- Public client interface ----
export const client = {
  get:    (path, { signal } = {}) => request('GET', path, undefined, { signal }),
  post:   (path, body) => request('POST', path, body),
  put:    (path, body) => request('PUT', path, body),
  patch:  (path, body) => request('PATCH', path, body),
  delete: (path)       => request('DELETE', path),

  /**
   * Upload files using multipart/form-data.
   * @param {string} path    — endpoint
   * @param {FormData} formData — a FormData instance with files + fields
   * @returns {Promise<any>}
   */
  upload: (path, formData) => request('POST', path, formData, { isFormData: true }),
};
