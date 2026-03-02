import { useState, useCallback, useEffect, useRef, createContext, useContext } from 'react';

/* ===== Styled Confirmation Dialog ===== */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'danger', onConfirm, onCancel }) {
  const dialogRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Focus trap
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) focusable[focusable.length - 1].focus();
    const trap = (e) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const els = dialogRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (els.length === 0) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [open]);

  if (!open) return null;

  const variants = {
    danger: { icon: '⚠️', btn: 'bg-red-500 hover:bg-red-600 text-white', ring: 'bg-red-100' },
    warning: { icon: '⚡', btn: 'bg-gold-500 hover:bg-gold-600 text-white', ring: 'bg-gold-100' },
    info: { icon: 'ℹ️', btn: 'bg-forest-500 hover:bg-forest-600 text-white', ring: 'bg-forest-100' },
  };
  const v = variants[variant] || variants.danger;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label={title || 'Confirmation'} onClick={onCancel}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        ref={dialogRef}
        className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-[fadeInUp_0.2s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className={`w-14 h-14 rounded-full ${v.ring} flex items-center justify-center text-2xl mb-4`}>
            {v.icon}
          </div>
          <h3 className="text-lg font-bold text-forest-500 mb-2">{title}</h3>
          <p className="text-gray-500 text-sm mb-6">{message}</p>
          <div className="flex gap-3 w-full">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition ${v.btn}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== useConfirm hook ===== */
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback(({ title, message, confirmLabel, cancelLabel, variant }) => {
    return new Promise((resolve) => {
      setState({ title, message, confirmLabel, cancelLabel, variant, resolve });
    });
  }, []);

  const handleConfirm = () => { state?.resolve(true); setState(null); };
  const handleCancel = () => { state?.resolve(false); setState(null); };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={!!state}
        title={state?.title}
        message={state?.message}
        confirmLabel={state?.confirmLabel}
        cancelLabel={state?.cancelLabel}
        variant={state?.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
