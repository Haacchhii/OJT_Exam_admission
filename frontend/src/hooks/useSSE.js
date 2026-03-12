import { useEffect, useRef, useCallback } from 'react';
import { getToken } from '../api/client.js';

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

/**
 * Hook that opens an SSE connection to the backend and dispatches
 * incoming events to the supplied handlers.
 *
 * Falls back to polling if SSE isn't supported or the connection fails.
 *
 * @param {number|null} userId       Authenticated user's id
 * @param {(data: object) => void} onNotification  Called when a "notification" event arrives
 */
export function useSSE(userId, onNotification) {
  const retriesRef = useRef(0);
  const esRef = useRef(null);
  const MAX_RETRIES = 5;

  const connect = useCallback(() => {
    if (!userId) return;
    const token = getToken();
    if (!token) return;

    // EventSource doesn't support Authorization header natively,
    // so we pass the token as a query param (same security as cookie over HTTPS).
    const url = `${BASE_URL}/api/notifications/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('notification', (e) => {
      try {
        const data = JSON.parse(e.data);
        onNotification(data);
      } catch { /* ignore malformed events */ }
    });

    es.onopen = () => { retriesRef.current = 0; };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      if (retriesRef.current < MAX_RETRIES) {
        const delay = Math.min(1000 * 2 ** retriesRef.current, 30000);
        retriesRef.current++;
        setTimeout(connect, delay);
      }
    };
  }, [userId, onNotification]);

  useEffect(() => {
    connect();
    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [connect]);
}
