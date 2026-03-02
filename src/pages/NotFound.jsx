import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forest-500 via-forest-600 to-forest-700 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-10 text-center">
        <span className="text-6xl block mb-4">🔑</span>
        <h1 className="text-7xl font-extrabold text-gold-400 mb-2">404</h1>
        <h2 className="text-xl font-bold text-forest-500 mb-2">Page Not Found</h2>
        <p className="text-gray-500 text-sm mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/login"
            className="bg-gradient-to-r from-forest-500 to-forest-400 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-gold-500 hover:to-gold-600 shadow-md transition-all"
          >
            Go to Login
          </Link>
          <button
            onClick={() => window.history.back()}
            className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition"
          >
            ← Go Back
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-8">&copy; 2026 GOLDEN KEY Integrated School of St. Joseph</p>
      </div>
    </div>
  );
}
