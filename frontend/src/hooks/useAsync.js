import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for async data fetching with AbortController and stale-while-revalidate.
 *
 * @param {(signal: AbortSignal) => Promise<T>} asyncFn — factory that returns a Promise (receives AbortSignal)
 * @param {any[]}            deps     — additional dependency values (re-fetches when they change)
 * @returns {{ data: T|null, loading: boolean, error: Error|null, refetch: () => void }}
 *
 * Usage:
 *   const { data, loading, error, refetch } = useAsync((signal) => getAdmissions({ signal }));
 *   // Or without signal (backward-compatible):
 *   const { data, loading, error, refetch } = useAsync(() => getAdmissions());
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
    const controller = new AbortController();

    // Stale-while-revalidate: only show loading spinner on initial fetch (no data yet)
    setLoading(prev => data === null ? true : prev);
    setError(null);

    fnRef.current(controller.signal)
      .then(result => {
        if (!controller.signal.aborted) {
          setData(result);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!controller.signal.aborted && err?.name !== 'AbortError') {
          setError(err);
          setLoading(false);
        }
      });

    return () => { controller.abort(); };
    // deps are user-provided values that should trigger refetch (e.g. userId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshCount, ...deps]);

  return { data, loading, error, refetch };
}
