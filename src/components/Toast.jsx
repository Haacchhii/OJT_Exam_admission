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
  setTimeout(() => {
    toastStore.toasts = toastStore.toasts.filter(t => t.id !== id);
    toastStore.listeners.forEach(fn => fn([...toastStore.toasts]));
  }, 3000);
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

  const colors = {
    success: 'bg-forest-500',
    error: 'bg-red-500',
    info: 'bg-forest-400',
    warning: 'bg-gold-500',
  };

  return createPortal(
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2" aria-live="polite" aria-atomic="false">
      {toasts.map(t => (
        <div key={t.id} className={`${colors[t.type] || colors.success} text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium animate-[fadeInUp_0.3s_ease-out] flex items-center gap-2`} role="alert">
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismissToast(t.id)} className="text-white/80 hover:text-white text-lg leading-none" aria-label="Dismiss notification">&times;</button>
        </div>
      ))}
    </div>,
    document.body
  );
}
