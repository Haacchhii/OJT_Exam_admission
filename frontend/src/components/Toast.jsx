import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

let toastId = 0;

const toastStore = { listeners: new Set(), toasts: [] };

const MAX_TOASTS = 5;

export function showToast(message, type = 'success') {
  const id = ++toastId;
  const toast = { id, message, type };
  toastStore.toasts = [...toastStore.toasts, toast];
  // Enforce stack limit
  if (toastStore.toasts.length > MAX_TOASTS) {
    toastStore.toasts = toastStore.toasts.slice(-MAX_TOASTS);
  }
  toastStore.listeners.forEach(fn => fn([...toastStore.toasts]));
  // Errors/warnings stay longer so users can read them
  const duration = (type === 'error' || type === 'warning') ? 5000 : 3000;
  setTimeout(() => {
    toastStore.toasts = toastStore.toasts.filter(t => t.id !== id);
    toastStore.listeners.forEach(fn => fn([...toastStore.toasts]));
  }, duration);
}

function dismissToast(id) {
  toastStore.toasts = toastStore.toasts.filter(t => t.id !== id);
  toastStore.listeners.forEach(fn => fn([...toastStore.toasts]));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    toastStore.listeners.add(setToasts);
    return () => toastStore.listeners.delete(setToasts);
  }, []);

  const styles = {
    success: 'bg-white border-emerald-200 text-emerald-700',
    error: 'bg-white border-red-200 text-red-700',
    info: 'bg-white border-forest-200 text-forest-700',
    warning: 'bg-white border-gold-200 text-gold-700',
  };
  const iconMap = { success: 'checkCircle', error: 'xCircle', info: 'info', warning: 'exclamation' };
  const iconColors = { success: 'text-emerald-500', error: 'text-red-500', info: 'text-forest-500', warning: 'text-gold-500' };

  return createPortal(
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5" aria-live="polite" aria-atomic="false">
      {toasts.map(t => {
        const IconComp = () => { try { const I = require('./Icons.jsx').default; return <I name={iconMap[t.type] || 'info'} className={`w-5 h-5 ${iconColors[t.type] || iconColors.info}`} />; } catch { return null; } };
        return (
          <div key={t.id} className={`${styles[t.type] || styles.success} backdrop-blur-xl border rounded-2xl shadow-elevated px-4 py-3.5 text-sm font-medium animate-[slideInRight_0.3s_ease-out] flex items-center gap-3 min-w-[280px] max-w-sm`} role="alert">
            <span className={`shrink-0 ${iconColors[t.type] || iconColors.info}`}>{['\u2713', '\u2717', 'i', '!'][['success','error','info','warning'].indexOf(t.type)] || 'i'}</span>
            <span className="flex-1 text-gray-700">{t.message}</span>
            <button onClick={() => dismissToast(t.id)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0" aria-label="Dismiss notification">&times;</button>
          </div>
        );
      })}
    </div>,
    document.body
  );
}
