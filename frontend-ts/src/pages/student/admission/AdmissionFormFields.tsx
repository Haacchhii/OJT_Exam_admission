import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from 'react';

/* ─── Input ─── */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Input({ label, type = 'text', required, error, className, ...props }: InputProps) {
  const id = props.id || `input-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  const inputCls = `w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none ${error ? 'border-red-400 focus:ring-red-500/20' : 'border-gray-300'}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
      <input id={id} type={type} {...props} className={inputCls} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-red-500" role="alert">{error}</p>}
    </div>
  );
}

/* ─── TextArea ─── */
interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export function TextArea({ label, required, error, className, ...props }: TextAreaProps) {
  const id = props.id || `textarea-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  const textareaCls = `w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none min-h-[80px] ${error ? 'border-red-400 focus:ring-red-500/20' : 'border-gray-300'}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
      <textarea id={id} {...props} className={textareaCls} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-red-500" role="alert">{error}</p>}
    </div>
  );
}

/* ─── Select ─── */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { v: string; l: string }[];
}

export function Select({ label, required, options, ...props }: SelectProps) {
  const id = props.id || `select-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
      <select id={id} {...props} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white">
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

/* ─── UploadSlot ─── */
interface UploadSlotProps {
  label: string;
  required?: boolean;
  slot: string;
  file: File | null;
  onFile: (slot: string, file: File) => void;
  onRemove: (slot: string) => void;
}

export function UploadSlot({ label, required, slot, file, onFile, onRemove }: UploadSlotProps) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</p>
      {file ? (
        <div className="border border-forest-200 bg-forest-50 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-forest-700">✅ {file.name} <span className="text-xs text-gray-400">({(file.size/1024).toFixed(1)} KB)</span></span>
          <button onClick={() => onRemove(slot)} className="text-red-400 hover:text-red-600 text-lg">✕</button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-gold-400 transition"
          onClick={() => document.getElementById(`slot-${slot}`)?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-gold-400'); }}
          onDragLeave={e => e.currentTarget.classList.remove('border-gold-400')}
          onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-gold-400'); if (e.dataTransfer.files[0]) onFile(slot, e.dataTransfer.files[0]); }}
        >
          <span className="text-2xl">📁</span>
          <p className="text-gray-500 text-sm mt-1">Click or drag file here</p>
        </div>
      )}
      <input id={`slot-${slot}`} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => { if (e.target.files?.[0]) onFile(slot, e.target.files[0]); e.target.value = ''; }} />
    </div>
  );
}

/* ─── Detail ─── */
interface DetailProps {
  label: string;
  value?: string;
  children?: ReactNode;
}

export function Detail({ label, value, children }: DetailProps) {
  return (
    <div>
      <span className="block text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      {children || <span className="text-sm text-forest-500 font-medium">{value}</span>}
    </div>
  );
}

/* ─── ReviewSection ─── */
interface ReviewSectionProps {
  title: ReactNode;
  children: ReactNode;
}

export function ReviewSection({ title, children }: ReviewSectionProps) {
  return (
    <div className="mb-6">
      <h4 className="font-semibold text-forest-500 mb-3">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 rounded-lg p-4">{children}</div>
    </div>
  );
}
