// ============================================
// store.js — localStorage persistence layer
// ============================================
import { defaultData } from './seed-data.js';

const STORAGE_KEY = 'goldenkey_data';

// In-memory cache to prevent race conditions from concurrent load()+save()
let _cache = null;

export function load() {
  if (_cache) return _cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      // Ensure all keys exist (empty arrays for any missing)
      for (const key of Object.keys(defaultData)) {
        if (data[key] === undefined) data[key] = JSON.parse(JSON.stringify(defaultData[key]));
      }
      _cache = data;
      return data;
    }
  } catch (e) {
    console.warn('Failed to load data, using defaults', e);
  }
  _cache = JSON.parse(JSON.stringify(defaultData));
  return _cache;
}

export function save(data) {
  _cache = data;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      console.error('localStorage quota exceeded. Data saved to memory only.');
    } else {
      throw e;
    }
  }
}

export function resetData() {
  _cache = null;
  localStorage.removeItem('gk_current_user');
  save(JSON.parse(JSON.stringify(defaultData)));
}
