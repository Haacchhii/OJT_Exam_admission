import { defaultData, type DefaultData } from './seed-data';

const STORAGE_KEY = 'goldenkey_data';

let _cache: DefaultData | null = null;

export function load(): DefaultData {
  if (_cache) return _cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as DefaultData;
      for (const key of Object.keys(defaultData) as (keyof DefaultData)[]) {
        if (data[key] === undefined) {
          (data as any)[key] = JSON.parse(JSON.stringify(defaultData[key]));
        }
      }
      _cache = data;
      return data;
    }
  } catch (e) {
    console.warn('Failed to load data, using defaults', e);
  }
  _cache = JSON.parse(JSON.stringify(defaultData)) as DefaultData;
  return _cache;
}

export function save(data: DefaultData): void {
  _cache = data;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
      console.error('localStorage quota exceeded. Data saved to memory only.');
    } else {
      throw e;
    }
  }
}

export function resetData(): void {
  _cache = null;
  localStorage.removeItem('gk_current_user');
  save(JSON.parse(JSON.stringify(defaultData)) as DefaultData);
}
