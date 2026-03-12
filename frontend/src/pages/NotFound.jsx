import { Link } from 'react-router-dom';
import Icon from '../components/Icons.jsx';
import { SCHOOL_NAME_SHORT, SCHOOL_NAME_SUBTITLE } from '../utils/constants';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center gk-auth-bg p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-elevated max-w-md w-full p-10 text-center border border-white/60 animate-[scaleIn_0.3s_ease-out]">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center mx-auto mb-5 shadow-lg">
          <Icon name="key" className="w-8 h-8 text-forest-800" />
        </div>
        <h1 className="text-7xl font-extrabold text-gold-400 mb-2">404</h1>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Page Not Found</h2>
        <p className="text-gray-500 text-sm mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/login"
            className="gk-btn-primary px-6 py-2.5 text-sm"
          >
            Go to Login
          </Link>
          <button
            onClick={() => window.history.back()}
            className="gk-btn-secondary px-6 py-2.5 text-sm"
          >
            ← Go Back
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-8">&copy; {new Date().getFullYear()} <span className="text-gold-500 font-bold">{SCHOOL_NAME_SHORT}</span> <span className="text-forest-500">{SCHOOL_NAME_SUBTITLE}</span></p>
      </div>
    </div>
  );
}
