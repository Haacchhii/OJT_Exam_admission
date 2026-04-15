import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Icon from './Icons';

/* ===== ActionButton ===== */
interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
}

export function ActionButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  type = 'button',
  ...props
}: ActionButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes: Record<string, string> = {
    sm: 'px-3.5 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
  };
  const variants: Record<string, string> = {
    primary: 'text-white bg-forest-500 hover:bg-forest-600 border border-forest-500',
    secondary: 'text-gray-700 bg-white hover:bg-gray-50 border border-gray-300',
    danger: 'text-white bg-red-600 hover:bg-red-700 border border-red-600',
    ghost: 'text-gray-600 bg-transparent hover:bg-gray-100 border border-transparent',
  };

  return (
    <button
      type={type}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="h-3.5 w-3.5 rounded-full border-2 border-white/60 border-t-white animate-spin" /> : icon}
      <span>{children}</span>
    </button>
  );
}

/* ===== SearchInput ===== */
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  ariaLabel = 'Search',
  className = '',
}: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <Icon name="search" className="w-4 h-4" />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full h-11 pl-10 pr-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-forest-500/15 focus:border-forest-500"
      />
    </div>
  );
}

/* ===== StatusStepper ===== */
interface StatusStep {
  key: string;
  label: string;
  hint?: string;
}

interface StatusStepperProps {
  steps: StatusStep[];
  currentKey: string;
  className?: string;
}

export function StatusStepper({ steps, currentKey, className = '' }: StatusStepperProps) {
  const currentIndex = Math.max(steps.findIndex((step) => step.key === currentKey), 0);

  return (
    <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {steps.map((step, index) => {
        const completed = index < currentIndex;
        const current = index === currentIndex;

        return (
          <div
            key={step.key}
            className={`rounded-lg border px-3 py-2.5 transition-colors ${
              current
                ? 'border-forest-300 bg-forest-50'
                : completed
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  current
                    ? 'bg-forest-500 text-white'
                    : completed
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-500'
                }`}
              >
                {completed ? '✓' : index + 1}
              </span>
              <span className={`text-sm font-semibold ${current ? 'text-forest-700' : completed ? 'text-emerald-700' : 'text-gray-600'}`}>
                {step.label}
              </span>
            </div>
            {step.hint && <p className="mt-1 text-xs text-gray-500">{step.hint}</p>}
          </div>
        );
      })}
    </div>
  );
}

/* ===== ErrorAlert ===== */
export function ErrorAlert({ error, onRetry }: { error?: Error | null; onRetry?: () => void }) {
  return (
    <div className="gk-card p-8 text-center" role="alert">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
        <Icon name="exclamation" className="w-7 h-7 text-red-500" />
      </div>
      <p className="text-gray-800 font-semibold mb-1">Something went wrong</p>
      <p className="text-gray-500 text-sm mb-5 max-w-md mx-auto">{error?.message || 'An unexpected error occurred.'}</p>
      {onRetry && (
        <button onClick={onRetry} data-testid="error-retry" className="gk-btn-primary text-sm px-6 py-2.5 inline-flex items-center gap-2">
          <Icon name="refresh" className="w-4 h-4" />
          Try Again
        </button>
      )}
    </div>
  );
}

/* ===== StatCard ===== */
interface StatCardProps {
  icon: string;
  value: string | number;
  label: string;
  color?: string;
  trend?: number | null;
  trendLabel?: string;
}

export function StatCard({ icon, value, label, color = 'blue', trend, trendLabel }: StatCardProps) {
  const iconColors: Record<string, string> = {
    blue: 'bg-forest-50 text-forest-500',
    green: 'bg-forest-50 text-forest-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-500',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-500',
    gold: 'bg-gold-50 text-gold-600',
  };
  const trendUp = (trend ?? 0) > 0;
  const trendDown = (trend ?? 0) < 0;
  return (
    <div className="gk-card p-6 hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-250">
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl ${iconColors[color] || iconColors.blue} flex items-center justify-center shrink-0`} aria-hidden="true">
          {typeof icon === 'string' && !/[\u{1F000}-\u{1FFFF}]/u.test(icon) ? <Icon name={icon} className="w-5 h-5" /> : <span className="text-lg">{icon}</span>}
        </div>
        {trend !== undefined && trend !== null && (
          <div className={`ml-auto flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${trendUp ? 'bg-emerald-50 text-emerald-600' : trendDown ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400'}`}
            aria-label={`${trendUp ? 'Up' : trendDown ? 'Down' : 'No change'} ${Math.abs(trend)}%${trendLabel ? `, ${trendLabel}` : ''}`}>
            {trendUp ? <Icon name="arrowTrendUp" className="w-3 h-3" /> : trendDown ? <Icon name="arrowTrendDown" className="w-3 h-3" /> : <span>—</span>}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="text-3xl stat-value">{value}</div>
        <div className="text-xs text-gray-500 mt-1 font-semibold uppercase tracking-wide">{label}</div>
      </div>
    </div>
  );
}

/* ===== Badge ===== */
interface BadgeProps {
  children: ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'danger';
  className?: string;
}

export function Badge({ children, variant, className: cls }: BadgeProps) {
  const variants: Record<string, string> = {
    info: 'gk-badge gk-badge-active',
    success: 'gk-badge gk-badge-accepted',
    warning: 'gk-badge gk-badge-submitted',
    danger: 'gk-badge gk-badge-rejected',
  };
  const resolved = cls || variants[variant || ''] || 'gk-badge gk-badge-inactive';
  return <span className={resolved}>{children}</span>;
}

/* ===== EmptyState ===== */
interface EmptyStateProps {
  icon?: string;
  title: string;
  text: string;
  action?: ReactNode;
}

export function EmptyState({ icon = 'inbox', title, text, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-5">
        {typeof icon === 'string' && !/[\u{1F000}-\u{1FFFF}]/u.test(icon) ? <Icon name={icon} className="w-8 h-8 text-gray-400" /> : <span className="text-3xl">{icon}</span>}
      </div>
      <h3 className="text-lg font-semibold text-gray-800 mb-1.5">{title}</h3>
      <p className="text-gray-500 text-sm mb-6 max-w-sm">{text}</p>
      {action}
    </div>
  );
}

/* ===== LoadingSpinner ===== */
export function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="relative">
        <div className="w-10 h-10 border-4 border-forest-100 border-t-forest-500 rounded-full animate-spin" />
      </div>
      <p className="text-xs text-gray-400 font-medium">Loading…</p>
    </div>
  );
}

/* ===== Process Feedback ===== */
interface ProcessStatePanelProps {
  title: string;
  message: string;
  tone?: 'info' | 'success' | 'warning';
  loading?: boolean;
}

export function ProcessStatePanel({
  title,
  message,
  tone = 'info',
  loading = true,
}: ProcessStatePanelProps) {
  const toneClass: Record<string, string> = {
    info: 'border-forest-200 bg-forest-50 text-forest-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
  };

  return (
    <div className="gk-section-card p-10 text-center">
      <div className={`mx-auto mb-4 w-14 h-14 rounded-2xl border flex items-center justify-center ${toneClass[tone] || toneClass.info}`}>
        {loading ? (
          <span className="h-6 w-6 rounded-full border-2 border-current/40 border-t-current animate-spin" />
        ) : (
          <Icon name="checkCircle" className="w-7 h-7" />
        )}
      </div>
      <h3 className="text-lg font-bold text-forest-600">{title}</h3>
      <p className="text-gray-500 text-sm mt-2">{message}</p>
    </div>
  );
}

interface StatusBannerProps {
  title: string;
  message?: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  className?: string;
}

export function StatusBanner({
  title,
  message,
  tone = 'info',
  className = '',
}: StatusBannerProps) {
  const toneClass: Record<string, string> = {
    info: 'border-forest-200 bg-forest-50 text-forest-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-red-200 bg-red-50 text-red-700',
  };

  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass[tone] || toneClass.info} ${className}`}>
      <p className="text-sm font-semibold flex items-center gap-2">
        <Icon
          name={tone === 'success' ? 'checkCircle' : tone === 'danger' ? 'xCircle' : tone === 'warning' ? 'clock' : 'info'}
          className="w-4 h-4"
        />
        {title}
      </p>
      {message && <p className="text-xs mt-1 opacity-90">{message}</p>}
    </div>
  );
}

/* ===== PageHeader ===== */
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8">
      <div>
        <h2 className="text-2xl lg:text-3xl text-gray-800 gk-heading">{title}</h2>
        {subtitle && <p className="text-gray-500 text-sm mt-2 max-w-3xl">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

/* ===== Pagination ===== */
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

export function Pagination({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);

  const pages: (number | string)[] = [];
  const maxVisible = 5;
  let sp = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let ep = Math.min(totalPages, sp + maxVisible - 1);
  if (ep - sp + 1 < maxVisible) sp = Math.max(1, ep - maxVisible + 1);

  if (sp > 1) { pages.push(1); if (sp > 2) pages.push('…1'); }
  for (let i = sp; i <= ep; i++) pages.push(i);
  if (ep < totalPages) { if (ep < totalPages - 1) pages.push('…2'); pages.push(totalPages); }

  return (
    <div className="p-4 lg:p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl mt-6 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <span className="text-sm text-gray-500">
        Showing <strong>{start}</strong>–<strong>{end}</strong> of <strong>{totalItems}</strong>
      </span>
      <div className="flex items-center gap-1">
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-2 rounded-xl border border-gray-200/60 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <Icon name="chevronLeft" className="w-4 h-4 text-gray-500" />
        </button>
        {pages.map((p) =>
          typeof p === 'string' ? (
            <span key={p} className="px-1.5 text-gray-300">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-9 h-9 text-sm rounded-xl transition-all ${
                p === currentPage
                  ? 'bg-forest-500 text-white font-semibold shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-2 rounded-xl border border-gray-200/60 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <Icon name="chevronRight" className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      </div>
    </div>
  );
}

/* ===== Helper: paginate an array ===== */
export function usePaginationSlice<T>(items: T[], page: number, perPage: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paginated = items.slice((safePage - 1) * perPage, safePage * perPage);
  return { paginated, totalPages, safePage, totalItems: items.length };
}

/* ===== Skeleton Components ===== */
function Bone({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200/70 rounded-lg ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="gk-card p-5 flex items-center gap-4">
      <Bone className="w-12 h-12 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2.5">
        <Bone className="h-6 w-16 rounded-lg" />
        <Bone className="h-3.5 w-24 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="gk-card p-5">
      <Bone className="h-5 w-48 mb-5 rounded-lg" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 items-center">
            {Array.from({ length: cols }).map((_, c) => (
              <Bone key={c} className="h-4 flex-1 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
      <div className="space-y-2.5">
        <Bone className="h-7 w-56 rounded-lg" />
        <Bone className="h-4 w-80 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <SkeletonTable />
    </div>
  );
}
