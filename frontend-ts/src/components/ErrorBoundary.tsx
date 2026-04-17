import { Component, type ErrorInfo, type ReactNode } from 'react';
import { SCHOOL_BRAND, SCHOOL_SUBTITLE, SCHOOL_YEAR } from '../utils/constants';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center gk-auth-bg p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-elevated max-w-md w-full p-10 text-center border border-white/60">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Something Went Wrong</h1>
            <p className="text-gray-500 text-sm mb-4">
              An unexpected error occurred. Try again or return to sign in.
            </p>
            {this.state.error && (
              <pre className="bg-gray-50/80 border border-gray-200/60 rounded-2xl p-3 text-left text-xs text-red-600 overflow-auto max-h-32 mb-5">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                }}
                className="gk-btn-primary px-6 py-2.5 text-sm"
              >
                Try Again
              </button>
              <a href="#/login" className="gk-btn-secondary px-6 py-2.5 text-sm">
                Go to Login
              </a>
            </div>
            <p className="text-xs text-gray-400 mt-6">
              &copy; {SCHOOL_YEAR} <span className="text-gold-500 font-bold">{SCHOOL_BRAND}</span>{' '}
              <span className="text-forest-500">{SCHOOL_SUBTITLE}</span>
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
