import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { showToast } from '../../components/Toast.jsx';
import Icon from '../../components/Icons.jsx';
import { SCHOOL_NAME, SCHOOL_NAME_SHORT, SCHOOL_NAME_SUBTITLE, ROLES } from '../../utils/constants';

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
      navigate(user.role === ROLES.APPLICANT ? '/student' : '/employee', { replace: true });
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
      const result = await login(email, password);
      if (!result.ok) { showToast(result.msg, 'error'); return; }
      if (remember) localStorage.setItem('gk_remember_email', email);
      else localStorage.removeItem('gk_remember_email');
      if (result.emailVerificationRequired) {
        showToast('Please verify your email address to continue.', 'warning');
        navigate('/verify-email', { state: { email } });
        return;
      }
      if (result.user.role === ROLES.APPLICANT) navigate('/student');
      else navigate('/employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex gk-auth-bg">
      {/* Left: Hero Panel */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 text-white overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-20 -left-16 w-64 h-64 bg-gold-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-32 right-0 w-48 h-48 bg-white/5 rounded-full blur-2xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center shadow-lg">
              <Icon name="key" className="w-5 h-5 text-forest-800" />
            </div>
            <span className="text-lg font-bold tracking-tight text-gold-400">{SCHOOL_NAME_SHORT}</span>
          </div>
          <p className="text-forest-300 text-sm font-semibold">{SCHOOL_NAME_SUBTITLE}</p>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-bold leading-tight">
            Empowering<br />
            <span className="text-gold-400">Bright Futures</span>
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-sm">
            Access your exams, track admissions, and manage your academic journey — all in one place.
          </p>
          <div className="flex gap-6 pt-2">
            <div className="text-center">
              <div className="text-2xl font-bold text-gold-400">500+</div>
              <div className="text-xs text-white/40">Students</div>
            </div>
            <div className="w-px bg-white/10" />
            <div className="text-center">
              <div className="text-2xl font-bold text-gold-400">50+</div>
              <div className="text-xs text-white/40">Teachers</div>
            </div>
            <div className="w-px bg-white/10" />
            <div className="text-center">
              <div className="text-2xl font-bold text-gold-400">98%</div>
              <div className="text-xs text-white/40">Pass Rate</div>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/30">&copy; {new Date().getFullYear()} {SCHOOL_NAME}. All rights reserved.</p>
      </div>

      {/* Right: Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md animate-[fadeIn_0.4s_ease-out]">
          {/* Mobile brand */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center mx-auto mb-3 shadow-lg">
              <Icon name="key" className="w-6 h-6 text-forest-800" />
            </div>
            <h1 className="text-lg font-bold text-gold-400">{SCHOOL_NAME_SHORT}</h1>
            <p className="text-sm text-forest-300 font-semibold">{SCHOOL_NAME_SUBTITLE}</p>
          </div>

          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-elevated p-8 sm:p-10 border border-white/60">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-800">Welcome back</h2>
              <p className="text-gray-500 text-sm mt-1">Sign in to continue to your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <Icon name="mail" className="w-4.5 h-4.5" />
                  </div>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required aria-describedby={errors.email ? 'email-error' : undefined}
                    data-testid="login-email"
                    className={`gk-input pl-11 ${errors.email ? 'border-red-400 focus:border-red-400' : ''}`} placeholder="your@email.com" />
                </div>
                {errors.email && <p id="email-error" className="text-red-500 text-xs mt-1.5 flex items-center gap-1" role="alert"><Icon name="exclamation" className="w-3.5 h-3.5" />{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <Icon name="lock" className="w-4.5 h-4.5" />
                  </div>
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required aria-describedby={errors.password ? 'password-error' : undefined}
                    data-testid="login-password"
                    className={`gk-input pl-11 pr-12 ${errors.password ? 'border-red-400 focus:border-red-400' : ''}`} placeholder="Enter your password" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" aria-label={showPw ? 'Hide password' : 'Show password'}>
                    <Icon name={showPw ? 'eyeOff' : 'eye'} className="w-4.5 h-4.5" />
                  </button>
                </div>
                {errors.password && <p id="password-error" className="text-red-500 text-xs mt-1.5 flex items-center gap-1" role="alert"><Icon name="exclamation" className="w-3.5 h-3.5" />{errors.password}</p>}
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-gray-600 cursor-pointer select-none">
                  <input type="checkbox" className="rounded border-gray-300 text-forest-500 focus:ring-forest-500/20" checked={remember} onChange={e => setRemember(e.target.checked)} /> Remember me
                </label>
                <Link to="/forgot-password" className="text-forest-500 hover:text-forest-600 font-medium transition-colors">Forgot password?</Link>
              </div>

              <button type="submit" disabled={loading}
                data-testid="login-submit"
                className="gk-btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                {loading ? (
                  <>
                    <Icon name="spinner" className="w-4 h-4 animate-spin" />
                    Signing In…
                  </>
                ) : 'Sign In'}
              </button>
            </form>

            {/* Test Credentials — only shown in development */}
            {import.meta.env.DEV && (
            <div className="mt-6 p-4 bg-gray-50/80 rounded-2xl border border-gray-200/60 text-xs">
              <div className="flex items-center gap-1.5 mb-3">
                <Icon name="info" className="w-3.5 h-3.5 text-forest-500" />
                <strong className="text-forest-600 text-xs">Test Accounts</strong>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-gray-400 uppercase text-[10px] font-semibold tracking-wider">Student</span>
                  <p className="text-gray-600 truncate mt-0.5">maria.santos@email.com</p>
                  <p className="text-gray-400 mt-0.5">pw: <code className="bg-gray-200/80 px-1.5 py-0.5 rounded text-gray-600">student123</code></p>
                </div>
                <div>
                  <span className="text-gray-400 uppercase text-[10px] font-semibold tracking-wider">Admin</span>
                  <p className="text-gray-600 truncate mt-0.5">admin@goldenkey.edu</p>
                  <p className="text-gray-400 mt-0.5">pw: <code className="bg-gray-200/80 px-1.5 py-0.5 rounded text-gray-600">admin123</code></p>
                </div>
                <div>
                  <span className="text-gray-400 uppercase text-[10px] font-semibold tracking-wider">Teacher</span>
                  <p className="text-gray-600 truncate mt-0.5">teacher@goldenkey.edu</p>
                  <p className="text-gray-400 mt-0.5">pw: <code className="bg-gray-200/80 px-1.5 py-0.5 rounded text-gray-600">admin123</code></p>
                </div>
              </div>
            </div>
            )}

            <p className="text-sm text-gray-500 text-center mt-6">
              Don't have an account? <Link to="/register" className="text-forest-500 hover:text-forest-600 font-semibold transition-colors">Create one</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
