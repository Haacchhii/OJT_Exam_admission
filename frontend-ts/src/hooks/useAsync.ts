import { useState, useEffect, useCallback, useRef } from 'react';

interface UseAsyncResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface UseAsyncOptions {
  autoRefreshOnDataChange?: boolean;
  autoRefreshOnFocus?: boolean;
  resourcePrefixes?: string[];
  setLoadingOnReload?: boolean;
}

interface DataChangedDetail {
  prefixes?: string[];
}

function shouldRefreshForPrefixes(resourcePrefixes: string[] | undefined, changedPrefixes: string[] | undefined): boolean {
  if (!resourcePrefixes || resourcePrefixes.length === 0) return true;
  if (!changedPrefixes || changedPrefixes.length === 0) return true;
  return resourcePrefixes.some(prefix => changedPrefixes.includes(prefix));
}

export function useAsync<T>(
  asyncFn: () => Promise<T>, 
  deps: unknown[] = [],
  pollInterval: number = 0,
  options: UseAsyncOptions = {}
): UseAsyncResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const {
    autoRefreshOnDataChange = false,
    autoRefreshOnFocus = false,
    resourcePrefixes,
    setLoadingOnReload = false,
  } = options;

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
    
    if (setLoadingOnReload || isFirstLoad.current || !data) {
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
    if (!autoRefreshOnDataChange) return;
    const onDataChanged = () => triggerAutoRefresh();
    const onScopedDataChanged = (evt: Event) => {
      const customEvt = evt as CustomEvent<DataChangedDetail>;
      if (shouldRefreshForPrefixes(resourcePrefixes, customEvt.detail?.prefixes)) {
        triggerAutoRefresh();
      }
    };
    window.addEventListener('gk:data-changed', onDataChanged);
    window.addEventListener('gk:data-changed-scoped', onScopedDataChanged);
    return () => {
      window.removeEventListener('gk:data-changed', onDataChanged);
      window.removeEventListener('gk:data-changed-scoped', onScopedDataChanged);
    };
  }, [autoRefreshOnDataChange, triggerAutoRefresh, resourcePrefixes]);

  useEffect(() => {
    if (!autoRefreshOnFocus) return;
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
  }, [autoRefreshOnFocus, triggerAutoRefresh]);

  return { data, loading, error, refetch };
}
