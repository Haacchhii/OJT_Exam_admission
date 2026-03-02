import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { showToast } from '../../components/Toast.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // Redirect already logged-in users
  useEffect(() => {
    if (user) {
      navigate(user.role === 'applicant' ? '/student' : '/employee', { replace: true });
    }
  }, [user, navigate]);

  // Restore remembered email
  useEffect(() => {
    const remembered = localStorage.getItem('gk_remember_email');
    if (remembered) { setEmail(remembered); setRemember(true); }
  }, []);

  const validate = () => {
    const errs = {};
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Invalid email format';
    if (!password) errs.password = 'Password is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const result = login(email, password);
      if (!result.ok) { showToast(result.msg, 'error'); return; }
      if (remember) localStorage.setItem('gk_remember_email', email);
      else localStorage.removeItem('gk_remember_email');
      if (result.user.role === 'applicant') navigate('/student');
      else navigate('/employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forest-500 via-forest-600 to-forest-700 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Brand */}
        <div className="text-center mb-8">
          <span className="text-4xl">🔑</span>
          <h1 className="text-xl font-bold text-forest-500 mt-2">GOLDEN KEY Integrated School of St. Joseph</h1>
          <p className="text-sm text-gray-500">Online Exam & Admission System</p>
        </div>

        <h2 className="text-2xl font-bold text-forest-500 mb-1">Welcome Back</h2>
        <p className="text-gray-500 text-sm mb-6">Sign in to your account to continue</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] outline-none transition ${errors.email ? 'border-red-400' : 'border-gray-300'}`} placeholder="your@email.com" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] outline-none transition pr-12 ${errors.password ? 'border-red-400' : 'border-gray-300'}`} placeholder="Enter your password" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-gray-600">
              <input type="checkbox" className="rounded" checked={remember} onChange={e => setRemember(e.target.checked)} /> Remember me
            </label>
            <Link to="/forgot-password" className="text-[#166534] hover:text-[#14532d] font-medium">Forgot password?</Link>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-forest-500 to-forest-400 text-white font-semibold py-2.5 rounded-lg hover:from-gold-500 hover:to-gold-600 transition-all shadow-md btn-shimmer disabled:opacity-60 disabled:cursor-not-allowed">
            {loading ? 'Signing In…' : 'Sign In'}
          </button>
        </form>

        {/* Test Credentials */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-xs">
          <strong className="text-forest-500 block mb-2">Test Accounts</strong>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-gray-400 uppercase text-[10px] font-semibold">Student</span>
              <p className="text-gray-600">maria.santos@email.com</p>
              <p className="text-gray-400">pw: <code className="bg-gray-200 px-1 rounded">student123</code></p>
            </div>
            <div>
              <span className="text-gray-400 uppercase text-[10px] font-semibold">Admin</span>
              <p className="text-gray-600">admin@goldenkey.edu</p>
              <p className="text-gray-400">pw: <code className="bg-gray-200 px-1 rounded">admin123</code></p>
            </div>
            <div>
              <span className="text-gray-400 uppercase text-[10px] font-semibold">Teacher</span>
              <p className="text-gray-600">teacher@goldenkey.edu</p>
              <p className="text-gray-400">pw: <code className="bg-gray-200 px-1 rounded">admin123</code></p>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-500 text-center mt-6">
          Don't have an account? <Link to="/register" className="text-[#166534] hover:text-[#14532d] font-medium">Create one</Link>
        </p>
      </div>
    </div>
  );
}
