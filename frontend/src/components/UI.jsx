import Icon from './Icons.jsx';

/* ===== ErrorAlert ===== */
export function ErrorAlert({ error, onRetry }) {
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
export function StatCard({ icon, value, label, color = 'blue', trend, trendLabel }) {
  const iconColors = {
    blue: 'bg-forest-50 text-forest-500',
    green: 'bg-forest-50 text-forest-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-500',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-500',
    gold: 'bg-gold-50 text-gold-600',
  };
  const trendUp = trend > 0;
  const trendDown = trend < 0;
  return (
    <div className="gk-card relative overflow-hidden p-5 flex items-center gap-4 group">
      {/* Decorative glow */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-forest-500/5 group-hover:bg-forest-500/8 transition-colors pointer-events-none" />
      <div className={`w-12 h-12 rounded-xl ${iconColors[color] || iconColors.blue} flex items-center justify-center shrink-0`} aria-hidden="true">
        {typeof icon === 'string' && !icon.match(/[\u{1F000}-\u{1FFFF}]/u) ? (
          <Icon name={icon} className="w-6 h-6" />
        ) : (
          <span className="text-xl">{icon}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-2xl font-bold stat-value">{value}</div>
        <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</div>
      </div>
      {trend !== undefined && trend !== null && (
        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${trendUp ? 'bg-emerald-50 text-emerald-600' : trendDown ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400'}`}
          aria-label={`${trendUp ? 'Up' : trendDown ? 'Down' : 'No change'} ${Math.abs(trend)}%${trendLabel ? `, ${trendLabel}` : ''}`}>
          {trendUp ? <Icon name="arrowTrendUp" className="w-3.5 h-3.5" /> : trendDown ? <Icon name="arrowTrendDown" className="w-3.5 h-3.5" /> : <span>—</span>}
          <span>{Math.abs(trend)}%</span>
        </div>
      )}
    </div>
  );
}

/* ===== Badge ===== */
export function Badge({ children, variant, className: cls }) {
  const variants = {
    info: 'bg-forest-50 text-forest-700 ring-1 ring-forest-200/60',
    success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60',
    warning: 'bg-gold-50 text-gold-700 ring-1 ring-gold-200/60',
    danger: 'bg-red-50 text-red-700 ring-1 ring-red-200/60',
  };
  const resolved = cls || variants[variant] || 'bg-gray-50 text-gray-600 ring-1 ring-gray-200/60';
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold ${resolved}`}>{children}</span>;
}

/* ===== EmptyState ===== */
export function EmptyState({ icon = 'inbox', title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-5">
        {typeof icon === 'string' && !icon.match(/[\u{1F000}-\u{1FFFF}]/u) ? (
          <Icon name={icon} className="w-8 h-8 text-gray-400" />
        ) : (
          <span className="text-3xl">{icon}</span>
        )}
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

/* ===== PageHeader ===== */
export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">{title}</h2>
        {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
        <div className="mt-2.5 h-1 w-10 rounded-full bg-gradient-to-r from-gold-400 to-gold-300" />
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

/* ===== Pagination ===== */
export function Pagination({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }) {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);

  // Build page number array with ellipsis
  const pages = [];
  const maxVisible = 5;
  let sp = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let ep = Math.min(totalPages, sp + maxVisible - 1);
  if (ep - sp + 1 < maxVisible) sp = Math.max(1, ep - maxVisible + 1);

  if (sp > 1) { pages.push(1); if (sp > 2) pages.push('…1'); }
  for (let i = sp; i <= ep; i++) pages.push(i);
  if (ep < totalPages) { if (ep < totalPages - 1) pages.push('…2'); pages.push(totalPages); }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-4 border-t border-gray-100/60">
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
  );
}

/* ===== Helper: paginate an array ===== */
export function usePaginationSlice(items, page, perPage) {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paginated = items.slice((safePage - 1) * perPage, safePage * perPage);
  return { paginated, totalPages, safePage, totalItems: items.length };
}

/* ===== Skeleton Components ===== */
function Bone({ className = '' }) {
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

export function SkeletonTable({ rows = 5, cols = 6 }) {
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
