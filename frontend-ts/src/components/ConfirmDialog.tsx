import { useState, useCallback, useEffect, useRef, createContext, useContext, type ReactNode } from 'react';
import Icon from './Icons';

type ConfirmVariant = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'danger', onConfirm, onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length) focusable[focusable.length - 1].focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const els = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (els.length === 0) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [open]);

  if (!open) return null;

  const variants: Record<ConfirmVariant, { icon: string; iconCls: string; btn: string; ring: string }> = {
    danger: { icon: 'exclamation', iconCls: 'text-red-500', btn: 'bg-red-500 hover:bg-red-600 text-white shadow-sm', ring: 'bg-red-50 ring-1 ring-red-100' },
    warning: { icon: 'exclamation', iconCls: 'text-gold-500', btn: 'bg-gold-500 hover:bg-gold-600 text-white shadow-sm', ring: 'bg-gold-50 ring-1 ring-gold-100' },
    info: { icon: 'info', iconCls: 'text-forest-500', btn: 'bg-forest-500 hover:bg-forest-600 text-white shadow-sm', ring: 'bg-forest-50 ring-1 ring-forest-100' },
  };
  const v = variants[variant] || variants.danger;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label={title || 'Confirmation'} onClick={onCancel}>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        ref={dialogRef}
        className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-elevated max-w-sm w-full p-8 animate-[scaleIn_0.2s_ease-out] border border-white/60"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className={`w-14 h-14 rounded-2xl ${v.ring} flex items-center justify-center mb-5`}>
            <Icon name={v.icon} className={`w-7 h-7 ${v.iconCls}`} />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">{message}</p>
          <div className="flex gap-3 w-full">
            <button onClick={onCancel} className="gk-btn-secondary flex-1 py-2.5 text-sm">{cancelLabel}</button>
            <button onClick={onConfirm} className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${v.btn}`}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== useConfirm hook ===== */
interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm: ConfirmFn = useCallback((opts) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, resolve });
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

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
