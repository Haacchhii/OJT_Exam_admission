import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forest-500 via-forest-600 to-forest-700 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-10 text-center">
            <span className="text-6xl block mb-4">⚠️</span>
            <h1 className="text-2xl font-bold text-forest-500 mb-2">Something Went Wrong</h1>
            <p className="text-gray-500 text-sm mb-4">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {this.state.error && (
              <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-left text-xs text-red-600 overflow-auto max-h-32 mb-4">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.hash = '#/login'; window.location.reload(); }}
              className="bg-gradient-to-r from-forest-500 to-forest-400 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-gold-500 hover:to-gold-600 shadow-md transition-all"
            >
              Reload Application
            </button>
            <p className="text-xs text-gray-400 mt-6">&copy; 2026 GOLDEN KEY Integrated School of St. Joseph</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
