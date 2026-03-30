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
  pollInterval: number = 60000 // default 60s auto-refresh polling
): UseAsyncResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const fnRef = useRef(asyncFn);
  fnRef.current = asyncFn;

  const isFirstLoad = useRef(true);
  const lastAutoRefreshAt = useRef(0);
  const AUTO_REFRESH_MIN_INTERVAL_MS = 8000;

  const triggerAutoRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastAutoRefreshAt.current < AUTO_REFRESH_MIN_INTERVAL_MS) return;
    lastAutoRefreshAt.current = now;
    setRefreshCount(c => c + 1);
  }, []);

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
          triggerAutoRefresh();
        }
      }, pollInterval);
      return () => clearInterval(timer);
    }
  }, [pollInterval, triggerAutoRefresh]);

  useEffect(() => {
    const onDataChanged = () => triggerAutoRefresh();
    window.addEventListener('gk:data-changed', onDataChanged);
    return () => window.removeEventListener('gk:data-changed', onDataChanged);
  }, [triggerAutoRefresh]);

  useEffect(() => {
    const onFocus = () => triggerAutoRefresh();
    const onVisibility = () => {
      if (!document.hidden) triggerAutoRefresh();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [triggerAutoRefresh]);

  return { data, loading, error, refetch };
}
