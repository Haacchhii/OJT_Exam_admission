import { ComponentType, lazy, Suspense, ReactNode } from 'react';
import { LoadingSpinner } from './UI';

/**
 * Enhanced lazy loading with automatic retry on failure.
 * Wraps React.lazy with exponential backoff retry logic.
 * 
 * @param importFunc - Dynamic import function: () => import('./Component')
 * @param maxAttempts - Number of retry attempts (default: 3)
 * @returns Lazy-loaded component
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  maxAttempts: number = 3
): T {
  return lazy(async () => {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await importFunc();
      } catch (error) {
        lastError = error as Error;
        console.warn(`Chunk load failed (attempt ${attempt}/${maxAttempts}):`, lastError?.message);
        
        if (attempt < maxAttempts) {
          // Wait before retrying (exponential backoff: 1s, 2s, 4s)
          const delayMs = 1000 * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
    
    // If chunks are stale after a deployment, surface a clear retryable error.
    const message = String(lastError?.message || '');
    const isChunkLoadError = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk/i.test(message);
    if (isChunkLoadError) {
      throw new Error('Failed to load the latest page resources. Please try again.');
    }

    // All retries exhausted
    throw lastError || new Error(`Failed to load module after ${maxAttempts} attempts`);
  }) as any;
}

/**
 * Loading fallback component for lazy-loaded pages.
 * Shows a centered spinner while chunks are loading.
 */
export function LazyLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner />
        <p className="text-gray-500 text-sm mt-4">Loading page...</p>
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

