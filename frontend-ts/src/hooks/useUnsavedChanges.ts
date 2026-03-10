import { useEffect, useCallback, useRef } from 'react';

interface UseUnsavedChangesResult {
  restore: () => Record<string, unknown> | null;
  clear: () => void;
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

  useEffect(() => {
    if (!storageKey || !formState) return;
    const timer = setTimeout(() => {
      if (dirtyRef.current) {
        sessionStorage.setItem(storageKey, JSON.stringify(formState));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [storageKey, formState]);

  const restore = useCallback((): Record<string, unknown> | null => {
    if (!storageKey) return null;
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }, [storageKey]);

  const clear = useCallback(() => {
    if (storageKey) sessionStorage.removeItem(storageKey);
  }, [storageKey]);

  return { restore, clear };
}
