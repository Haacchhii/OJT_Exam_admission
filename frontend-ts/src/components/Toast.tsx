import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatApiError } from '../utils/errorHandler';
import type { ToastType } from '../types';

let toastId = 0;

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

const toastStore = {
  listeners: new Set<(toasts: Toast[]) => void>(),
  toasts: [] as Toast[],
};

const MAX_TOASTS = 5;

export function showToast(message: string, type: ToastType = 'success') {
  const id = ++toastId;
  const toast: Toast = { id, message, type };
  toastStore.toasts = [...toastStore.toasts, toast];
  if (toastStore.toasts.length > MAX_TOASTS) {
    toastStore.toasts = toastStore.toasts.slice(-MAX_TOASTS);
  }
  toastStore.listeners.forEach(fn => fn([...toastStore.toasts]));
  const duration = (type === 'error' || type === 'warning') ? 5000 : 3000;
  setTimeout(() => {
    toastStore.toasts = toastStore.toasts.filter(t => t.id !== id);
    toastStore.listeners.forEach(fn => fn([...toastStore.toasts]));
  }, duration);
}

/**
 * Show an error toast with automatic error message formatting
 */
export function showErrorToast(error: unknown, fallback = 'An error occurred') {
  const message = formatApiError(error) || fallback;
  showToast(message, 'error');
}

function dismissToast(id: number) {
  toastStore.toasts = toastStore.toasts.filter(t => t.id !== id);
  toastStore.listeners.forEach(fn => fn([...toastStore.toasts]));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    toastStore.listeners.add(setToasts);
    return () => { toastStore.listeners.delete(setToasts); };
  }, []);

  const styles: Record<ToastType, string> = {
    success: 'bg-white border-emerald-200 text-emerald-700',
    error: 'bg-white border-red-200 text-red-700',
    info: 'bg-white border-forest-200 text-forest-700',
    warning: 'bg-white border-gold-200 text-gold-700',
  };

  const iconSymbols: Record<ToastType, string> = {
    success: '\u2713',
    error: '\u2717',
    info: 'i',
    warning: '!',
  };

  const iconColors: Record<ToastType, string> = {
    success: 'text-emerald-500',
    error: 'text-red-500',
    info: 'text-forest-500',
    warning: 'text-gold-500',
  };

  return createPortal(
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5" aria-live="polite" aria-atomic="false">
      {toasts.map(t => (
        <div key={t.id} className={`${styles[t.type] || styles.success} backdrop-blur-xl border rounded-2xl shadow-elevated px-4 py-3.5 text-sm font-medium animate-[slideInRight_0.3s_ease-out] flex items-center gap-3 min-w-[280px] max-w-sm`} role="alert">
          <span className={`shrink-0 ${iconColors[t.type] || iconColors.info}`}>{iconSymbols[t.type] || 'i'}</span>
          <span className="flex-1 text-gray-700">{t.message}</span>
          <button onClick={() => dismissToast(t.id)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0" aria-label="Dismiss message">&times;</button>
        </div>
      ))}
    </div>,
    document.body
  );
}
