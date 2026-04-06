type UserRole = 'administrator' | 'registrar' | 'teacher' | 'applicant';

type PrefetchFn = () => Promise<unknown>;

const routePrefetchers: Record<string, PrefetchFn> = {
  '/student': () => import('../pages/student/Dashboard'),
  '/student/dashboard': () => import('../pages/student/Dashboard'),
  '/student/admission': () => import('../pages/student/Admission'),
  '/student/exam': () => import('../pages/student/Exam'),
  '/student/results': () => import('../pages/student/Results'),
  '/student/profile': () => import('../pages/shared/Profile'),

  '/employee': () => import('../pages/employee/Dashboard'),
  '/employee/dashboard': () => import('../pages/employee/Dashboard'),
  '/employee/admissions': () => import('../pages/employee/Admissions'),
  '/employee/exams': () => import('../pages/employee/Exams'),
  '/employee/results': () => import('../pages/employee/Results'),
  '/employee/reports': () => import('../pages/employee/Reports'),
  '/employee/users': () => import('../pages/employee/Users'),
  '/employee/audit': () => import('../pages/employee/AuditLog'),
  '/employee/settings': () => import('../pages/employee/Settings'),
  '/employee/profile': () => import('../pages/shared/Profile'),
};

const prefetched = new Set<string>();

function normalizePath(path: string): string {
  const clean = String(path || '').replace(/^#/, '').split('?')[0];
  return clean || '/';
}

function runWhenIdle(task: () => void) {
  if (typeof globalThis === 'undefined') return;

  if ('requestIdleCallback' in globalThis) {
    (globalThis as typeof globalThis & { requestIdleCallback: (cb: IdleRequestCallback) => number }).requestIdleCallback(() => {
      task();
    });
    return;
  }

  globalThis.setTimeout(task, 350);
}

function canPrefetchRoutes(): boolean {
  if (typeof navigator === 'undefined') return false;

  const netInfo = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
    deviceMemory?: number;
  }).connection;
  const saveData = !!netInfo?.saveData;
  const effectiveType = String(netInfo?.effectiveType || '').toLowerCase();
  const isSlowNetwork = effectiveType.includes('2g') || effectiveType === 'slow-2g';

  const cpuCores = navigator.hardwareConcurrency || 0;
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0;
  const isConstrainedDevice = (cpuCores > 0 && cpuCores <= 4) || (deviceMemory > 0 && deviceMemory <= 4);

  return !saveData && !isSlowNetwork && !isConstrainedDevice;
}

export function prefetchRouteByPath(path: string): void {
  const normalized = normalizePath(path);
  const importer = routePrefetchers[normalized];
  if (!importer || prefetched.has(normalized)) return;

  prefetched.add(normalized);
  void importer().catch(() => {
    prefetched.delete(normalized);
  });
}

export function prefetchLikelyRoutesForRole(role: UserRole | null, currentPath: string): void {
  if (!canPrefetchRoutes()) return;

  const normalizedCurrent = normalizePath(currentPath);
  const candidates = role === 'applicant'
    ? ['/student/admission', '/student/exam', '/student/results']
    : ['/employee/admissions', '/employee/exams', '/employee/results', '/employee/reports'];

  const maxTargets = 1;
  const targets = candidates.filter((path) => path !== normalizedCurrent).slice(0, maxTargets);

  // Stage prefetches so we avoid a sudden burst of network/parse work.
  targets.forEach((path, idx) => {
    runWhenIdle(() => {
      globalThis.setTimeout(() => prefetchRouteByPath(path), idx * 800);
    });
  });
}
