import { onCLS, onINP, onLCP, onTTFB, onFCP } from 'web-vitals';

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
}

function sendMetric(metric: {
  name: string;
  value: number;
  rating?: string;
  id?: string;
  navigationType?: string;
}) {
  const apiBase = getApiBaseUrl();
  const endpoint = `${apiBase}/api/perf/vitals`;

  const payload = {
    metric: metric.name,
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
    navigationType: metric.navigationType,
    page: window.location.pathname,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
  };

  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(endpoint, blob);
    return;
  }

  void fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  });
}

export function startPerfVitalsReporting() {
  onCLS(sendMetric);
  onINP(sendMetric);
  onLCP(sendMetric);
  onTTFB(sendMetric);
  onFCP(sendMetric);
}
