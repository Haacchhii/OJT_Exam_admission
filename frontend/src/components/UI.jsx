/* ===== ErrorAlert ===== */
export function ErrorAlert({ error, onRetry }) {
  return (
    <div className="lpu-card p-8 text-center" role="alert">
      <span className="text-4xl block mb-3">⚠️</span>
      <p className="text-red-600 font-semibold mb-1">Something went wrong</p>
      <p className="text-gray-500 text-sm mb-4">{error?.message || 'An unexpected error occurred.'}</p>
      {onRetry && (
        <button onClick={onRetry} data-testid="error-retry" className="bg-[#166534] text-white px-5 py-2 rounded-lg font-semibold hover:bg-[#14532d] text-sm">
          Try Again
        </button>
      )}
    </div>
  );
}

/* ===== StatCard ===== */
export function StatCard({ icon, value, label, color = 'blue', trend, trendLabel }) {
  const colors = {
    blue: 'from-forest-500 to-forest-400',
    green: 'from-forest-500 to-forest-600',
    emerald: 'from-emerald-500 to-emerald-600',
    orange: 'from-orange-400 to-orange-500',
    amber: 'from-forest-500 to-forest-400',
    red: 'from-red-500 to-red-600',
    gold: 'from-forest-500 to-forest-400',
  };
  const trendUp = trend > 0;
  const trendDown = trend < 0;
  return (
    <div className="lpu-card relative overflow-hidden p-5 flex items-center gap-4">
      {/* Decorative circle */}
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#166534]/5 pointer-events-none" />
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[color] || colors.blue} flex items-center justify-center text-white text-xl shrink-0`} aria-hidden="true">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-2xl font-bold stat-value">{value}</div>
        <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</div>
      </div>
      {trend !== undefined && trend !== null && (
        <div className={`flex flex-col items-end text-xs font-semibold ${trendUp ? 'text-green-600' : trendDown ? 'text-red-500' : 'text-gray-400'}`}
          aria-label={`${trendUp ? 'Up' : trendDown ? 'Down' : 'No change'} ${Math.abs(trend)}%${trendLabel ? `, ${trendLabel}` : ''}`}>
          <span aria-hidden="true">{trendUp ? '▲' : trendDown ? '▼' : '—'} {Math.abs(trend)}%</span>
          {trendLabel && <span className="text-[10px] text-gray-400 font-normal">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}

/* ===== Badge ===== */
export function Badge({ children, variant, className: cls }) {
  const variants = {
    info: 'bg-forest-100 text-forest-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-gold-100 text-gold-700',
    danger: 'bg-red-100 text-red-700',
  };
  const resolved = cls || variants[variant] || 'bg-gray-100 text-gray-600';
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${resolved}`}>{children}</span>;
}

/* ===== EmptyState ===== */
export function EmptyState({ icon = '📭', title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-5xl mb-4">{icon}</span>
      <h3 className="text-lg font-semibold text-forest-500 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm mb-4 max-w-sm">{text}</p>
      {action}
    </div>
  );
}

/* ===== LoadingSpinner ===== */
export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-forest-200 border-t-[#166534] rounded-full animate-spin" />
    </div>
  );
}

/* ===== PageHeader ===== */
export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h2 className="text-2xl font-bold text-[#1e293b] tracking-tight">{title}</h2>
        {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
        <div className="mt-2 h-1 w-12 rounded-full bg-gold-400" />
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
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100">
      <span className="text-sm text-gray-500">
        Showing <strong>{start}</strong>–<strong>{end}</strong> of <strong>{totalItems}</strong>
      </span>
      <div className="flex items-center gap-1">
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          ‹ Prev
        </button>
        {pages.map((p, i) =>
          typeof p === 'string' ? (
            <span key={p} className="px-2 text-gray-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`px-3 py-1.5 text-sm rounded-lg transition ${
                p === currentPage
                  ? 'bg-[#166534] text-white font-semibold'
                  : 'border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Next ›
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
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="lpu-card p-5 flex items-center gap-4">
      <Bone className="w-12 h-12 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Bone className="h-6 w-16" />
        <Bone className="h-4 w-24" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 6 }) {
  return (
    <div className="lpu-card p-4">
      <Bone className="h-5 w-48 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 items-center">
            {Array.from({ length: cols }).map((_, c) => (
              <Bone key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="space-y-6 animate-[fadeInUp_0.3s_ease-out]">
      <div className="space-y-2">
        <Bone className="h-7 w-56" />
        <Bone className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <SkeletonTable />
    </div>
  );
}
