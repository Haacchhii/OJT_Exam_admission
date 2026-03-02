import { useEffect, useCallback, useRef } from 'react';

/**
 * Hook to warn users about unsaved changes.
 * - Shows browser beforeunload dialog if isDirty is true.
 * - Optionally auto-saves form state to sessionStorage.
 *
 * @param {boolean} isDirty - Whether the form has unsaved changes
 * @param {string} [storageKey] - Optional key for auto-save to sessionStorage
 * @param {object} [formState] - State to persist
 * @returns {{ restore: () => object|null, clear: () => void }}
 */
export function useUnsavedChanges(isDirty, storageKey, formState) {
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  // beforeunload warning
  useEffect(() => {
    const handler = (e) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Auto-save to sessionStorage
  useEffect(() => {
    if (!storageKey || !formState) return;
    const timer = setTimeout(() => {
      if (dirtyRef.current) {
        sessionStorage.setItem(storageKey, JSON.stringify(formState));
      }
    }, 1000); // debounce 1s
    return () => clearTimeout(timer);
  }, [storageKey, formState]);

  const restore = useCallback(() => {
    if (!storageKey) return null;
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [storageKey]);

  const clear = useCallback(() => {
    if (storageKey) sessionStorage.removeItem(storageKey);
  }, [storageKey]);

  return { restore, clear };
}
