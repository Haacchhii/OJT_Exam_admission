import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for async data fetching.
 *
 * @param {() => Promise<T>} asyncFn  — factory that returns a Promise
 * @param {any[]}            deps     — additional dependency values (re-fetches when they change)
 * @returns {{ data: T|null, loading: boolean, error: Error|null, refetch: () => void }}
 *
 * Usage:
 *   const { data, loading, error, refetch } = useAsync(() => getAdmissions());
 *   const { data, loading, error, refetch } = useAsync(
 *     () => Promise.all([getStats(), getAdmissions()]).then(([stats, adm]) => ({ stats, adm }))
 *   );
 */
export function useAsync(asyncFn, deps = []) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [refreshCount, setRefreshCount] = useState(0);

  // Stabilize the asyncFn reference to prevent infinite re-renders
  const fnRef = useRef(asyncFn);
  fnRef.current = asyncFn;

  const refetch = useCallback(() => setRefreshCount(c => c + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fnRef.current()
      .then(result => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
    // deps are user-provided values that should trigger refetch (e.g. userId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshCount, ...deps]);

  return { data, loading, error, refetch };
}
