import { ComponentType, lazy } from 'react';
import { LoadingSpinner } from './UI';

const CHUNK_REFRESH_ONCE_KEY = 'gk_chunk_refresh_once';

function isChunkLoadErrorMessage(message: string): boolean {
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|Unable to fetch dynamically imported module|ChunkLoadError/i.test(message);
}

function triggerOneTimeChunkRecovery(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const hasRefreshed = window.sessionStorage.getItem(CHUNK_REFRESH_ONCE_KEY) === '1';
    if (hasRefreshed) {
      window.sessionStorage.removeItem(CHUNK_REFRESH_ONCE_KEY);
      return false;
    }
    window.sessionStorage.setItem(CHUNK_REFRESH_ONCE_KEY, '1');
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

/**
 * Enhanced lazy loading with automatic retry on failure.
 * Wraps React.lazy with short retry delays to handle transient chunk fetch issues.
 * 
 * @param importFunc - Dynamic import function: () => import('./Component')
 * @param maxAttempts - Number of retry attempts (default: 2)
 * @returns Lazy-loaded component
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  maxAttempts: number = 2
): T {
  return lazy(async () => {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const loaded = await importFunc();
        if (typeof window !== 'undefined') {
          try {
            window.sessionStorage.removeItem(CHUNK_REFRESH_ONCE_KEY);
          } catch {
            // Ignore session storage cleanup failures.
          }
        }
        return loaded;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Chunk load failed (attempt ${attempt}/${maxAttempts}):`, lastError?.message);
        
        if (attempt < maxAttempts) {
          // Keep retry delays short to reduce perceived route-navigation blocking.
          const delayMs = 250 * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
    
    // If chunks are stale after a deployment, surface a clear retryable error.
    const message = String(lastError?.message || '');
    const isChunkLoadError = isChunkLoadErrorMessage(message);
    if (isChunkLoadError) {
      if (triggerOneTimeChunkRecovery()) {
        // Keep this promise pending while the browser refreshes the app shell.
        return new Promise(() => {
          // no-op
        });
      }
      throw new Error('Failed to load the latest page resources. Please try again.');
    }

    // All retries exhausted
    throw lastError || new Error(`Failed to load module after ${maxAttempts} attempts`);
  }) as any;
}

/**
 * Loading fallback component for lazy-loaded pages.
 * Compact by default for in-page route transitions; supports full-screen mode when needed.
 */
export function LazyLoadingFallback({
  fullScreen = false,
  message = 'Loading page...',
}: {
  fullScreen?: boolean;
  message?: string;
}) {
  return (
    <div className={fullScreen ? 'min-h-screen flex items-center justify-center' : 'w-full py-10 flex items-center justify-center'}>
      <div className="text-center">
        <LoadingSpinner />
        <p className="text-gray-500 text-sm mt-4">{message}</p>
      </div>
    </div>
  );
}

/**
 * Error fallback component for failed chunk loads.
 * Shows user-friendly error message with retry option.
 */
export function ChunkErrorFallback({ error, retry }: { error?: Error; retry?: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center border border-gray-100">
        <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">Failed to Load Page</h2>
        <p className="text-gray-500 text-sm mb-4">
          The application encountered an issue loading this page. This might be a temporary network or deployment update issue.
        </p>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-left">
            <p className="text-xs text-red-700 font-mono break-words">
              {error.message || 'Unknown error occurred'}
            </p>
          </div>
        )}
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => retry?.()}
            disabled={!retry}
            className="gk-btn-primary px-4 py-2 text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}

