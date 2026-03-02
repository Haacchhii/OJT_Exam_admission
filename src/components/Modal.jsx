import { useEffect, useRef } from 'react';

export default function Modal({ open, onClose, children, title, maxWidth = 'max-w-lg' }) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);

  // Capture the element that opened the modal
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Focus trap inside modal
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) focusable[0].focus();

    const trapFocus = (e) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const els = dialogRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => document.removeEventListener('keydown', trapFocus);
  }, [open]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Restore focus when modal closes
  useEffect(() => {
    if (!open && triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title || 'Dialog'} onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        ref={dialogRef}
        className={`relative bg-white rounded-2xl shadow-2xl ${maxWidth} w-full overflow-hidden animate-[fadeInUp_0.2s_ease-out]`}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="bg-forest-gradient px-6 py-4 rounded-t-2xl">
            <h3 className="text-lg font-bold text-white">{title}</h3>
          </div>
        )}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
