import { useState, type FormEvent } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { client } from '../../api/client';
import { showToast } from '../../components/Toast';
import Icon from '../../components/Icons';

export default function ForgotPassword() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  if (user) return <Navigate to={user.role === 'applicant' ? '/student' : '/employee'} replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await client.post<{ resetToken: string }>('/auth/forgot-password', { email });
      sessionStorage.setItem('gk_reset_token', JSON.stringify({ resetToken: res.resetToken, email, expires: Date.now() + 15 * 60 * 1000 }));
      showToast('You can now reset your password.', 'success');
      navigate('/reset-password');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Something went wrong. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gk-auth-bg p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-elevated w-full max-w-md p-8 sm:p-10 border border-white/60 animate-[fadeIn_0.4s_ease-out]">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-4">
            <Icon name="lock" className="w-7 h-7 text-forest-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Forgot Password</h2>
          <p className="text-gray-500 text-sm mt-1">Enter your registered email to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><Icon name="mail" className="w-4.5 h-4.5" /></div>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="gk-input pl-11" placeholder="your@email.com" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="gk-btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">{loading ? <><Icon name="spinner" className="w-4 h-4 animate-spin" />Verifying…</> : 'Verify Email'}</button>
        </form>

        <p className="text-sm text-gray-500 text-center mt-6">Back to <Link to="/login" className="text-forest-500 hover:text-forest-600 font-semibold transition-colors">Sign in</Link></p>
      </div>
    </div>
  );
}
