import { useState, useEffect, useCallback, useRef } from 'react';

interface UseAsyncResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useAsync<T>(
  asyncFn: () => Promise<T>, 
  deps: unknown[] = [],
  pollInterval: number = 15000 // default 15s auto-refresh polling
): UseAsyncResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const fnRef = useRef(asyncFn);
  fnRef.current = asyncFn;

  const isFirstLoad = useRef(true);

  const refetch = useCallback(() => setRefreshCount(c => c + 1), []);

  useEffect(() => {
    let cancelled = false;
    
    if (isFirstLoad.current || !data) {
      setLoading(true);
    }
    setError(null);

    fnRef.current()
      .then(result => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
          isFirstLoad.current = false;
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err as Error);
          setLoading(false);
          isFirstLoad.current = false;
        }
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshCount, ...deps]);

  // Set up polling for auto-updating pages
  useEffect(() => {
    if (pollInterval > 0) {
      const timer = setInterval(() => {
        // Only fetch if the browser tab is currently active
        if (!document.hidden) {
          setRefreshCount(c => c + 1);
        }
      }, pollInterval);
      return () => clearInterval(timer);
    }
  }, [pollInterval]);

  return { data, loading, error, refetch };
}
