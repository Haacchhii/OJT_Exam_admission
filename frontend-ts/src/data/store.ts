import { defaultData, type DefaultData } from './seed-data';

const BASE_STORAGE_KEY = 'goldenkey_data';

// In-memory cache per storage key (to avoid cross-user leakage in the same tab)
const inMemoryCaches: Map<string, DefaultData> = new Map();

function currentUserId(): string {
  // Prefer session-scoped user id, fall back to localStorage, otherwise anonymous
  return (
    sessionStorage.getItem('gk_current_user') ||
    localStorage.getItem('gk_current_user') ||
    'anonymous'
  );
}

function storageKeyForUser(): string {
  return `${BASE_STORAGE_KEY}:${currentUserId()}`;
}

export function load(): DefaultData {
  const key = storageKeyForUser();
  const cached = inMemoryCaches.get(key);
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const data = JSON.parse(raw) as DefaultData;
      for (const k of Object.keys(defaultData) as (keyof DefaultData)[]) {
        if (data[k] === undefined) {
          (data as any)[k] = JSON.parse(JSON.stringify(defaultData[k]));
        }
      }
      inMemoryCaches.set(key, data);
      return data;
    }
    // Migration: if per-user key not present but legacy global key exists, copy it
    const legacy = localStorage.getItem(BASE_STORAGE_KEY);
    if (legacy) {
      try {
        const legacyData = JSON.parse(legacy) as DefaultData;
        inMemoryCaches.set(key, legacyData);
        // Save under per-user key so future loads are isolated
        localStorage.setItem(key, JSON.stringify(legacyData));
        return legacyData;
      } catch (e) {
        // ignore parse errors and fallthrough to defaults
      }
    }
  } catch (e) {
    console.warn('Failed to load data, using defaults', e);
  }
  const copy = JSON.parse(JSON.stringify(defaultData)) as DefaultData;
  inMemoryCaches.set(key, copy);
  return copy;
}

export function save(data: DefaultData): void {
  const key = storageKeyForUser();
  inMemoryCaches.set(key, data);
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || (e as any).code === 22)) {
      console.error('localStorage quota exceeded. Data saved to memory only.');
    } else {
      throw e;
    }
  }
}

export function resetData(): void {
  const key = storageKeyForUser();
  inMemoryCaches.delete(key);
  // Remove only current user's auth/session keys; do not wipe other users
  sessionStorage.removeItem('gk_current_user');
  sessionStorage.removeItem('gk_user_hash');
  sessionStorage.removeItem('gk_auth_token');
  localStorage.removeItem('gk_current_user');
  localStorage.removeItem('gk_user_hash');
  localStorage.removeItem('gk_auth_token');
  // Initialize storage for this user with defaults
  save(JSON.parse(JSON.stringify(defaultData)) as DefaultData);
}
