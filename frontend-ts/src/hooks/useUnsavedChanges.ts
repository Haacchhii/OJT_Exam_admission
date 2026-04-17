import { useEffect, useCallback, useRef } from 'react';

interface UseUnsavedChangesResult {
  restore: () => Record<string, unknown> | null;
  clear: () => void;
}

function emitStorageChanged(storageKey: string) {
  window.dispatchEvent(new CustomEvent('gk:storage-changed', {
    detail: { key: storageKey },
  }));
}

export function useUnsavedChanges(
  isDirty: boolean,
  storageKey?: string,
  formState?: Record<string, unknown>
): UseUnsavedChangesResult {
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Save to localStorage (persists across browser close, reload, connection loss)
  useEffect(() => {
    if (!storageKey || !formState) return;
    const timer = setTimeout(() => {
      if (dirtyRef.current) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(formState));
          emitStorageChanged(storageKey);
        } catch {
          /* quota exceeded */
        }
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [storageKey, formState]);

  const restore = useCallback((): Record<string, unknown> | null => {
    if (!storageKey) return null;
    try {
      // Try localStorage first (persistent), fall back to sessionStorage (legacy)
      const raw = localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey);
      if (raw) {
        // Migrate from sessionStorage to localStorage
        sessionStorage.removeItem(storageKey);
        emitStorageChanged(storageKey);
      }
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }, [storageKey]);

  const clear = useCallback(() => {
    if (storageKey) {
      localStorage.removeItem(storageKey);
      sessionStorage.removeItem(storageKey);
      emitStorageChanged(storageKey);
    }
  }, [storageKey]);

  return { restore, clear };
}
