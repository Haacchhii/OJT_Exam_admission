// ============================================
// client.js — HTTP client for backend API
// ============================================
// When VITE_API_URL is set, all API modules use this client.
// When empty, API modules fall back to localStorage.

const BASE_URL = import.meta.env.VITE_API_URL || '';

/** True when a backend URL is configured */
export const USE_API = !!BASE_URL;

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

// ---- Core request function ----
async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Network error. Please check your connection and try again.', 0);
  }

  // 401 — session expired → auto-logout
  if (res.status === 401) {
    setToken(null);
    if (onAuthError) onAuthError();
    throw new ApiError('Session expired. Please log in again.', 401);
  }

  // 403 — forbidden
  if (res.status === 403) {
    throw new ApiError('You do not have permission to perform this action.', 403);
  }

  // 404 — not found
  if (res.status === 404) {
    throw new ApiError('The requested resource was not found.', 404);
  }

  // Parse response body
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('json') ? await res.json() : await res.text();

  // Any other non-2xx error
  if (!res.ok) {
    const message =
      typeof data === 'object' && data?.message ? data.message
      : typeof data === 'object' && data?.error ? data.error
      : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, data);
  }

  return data;
}

// ---- Public client interface ----
export const client = {
  get:    (path)       => request('GET', path),
  post:   (path, body) => request('POST', path, body),
  put:    (path, body) => request('PUT', path, body),
  patch:  (path, body) => request('PATCH', path, body),
  delete: (path)       => request('DELETE', path),
};
