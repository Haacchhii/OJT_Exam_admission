import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { client } from '../../api/client';
import { showToast } from '../../components/Toast';
import { getPasswordStrength } from '../../utils/passwordStrength';
import Icon from '../../components/Icons';

export default function ResetPassword() {
  const { user: authUser } = useAuth();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      showToast('Reset link is missing or invalid. Please request a new one.', 'error');
      navigate('/forgot-password');
      return;
    }
    setResetToken(token);
  }, [navigate, searchParams]);

  if (authUser) return <Navigate to={authUser.role === 'applicant' ? '/student' : '/employee'} replace />;

  const strength = getPasswordStrength(pw);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) { showToast('Password must be at least 8 characters', 'error'); return; }
    if (strength.score < 3) { showToast('Password is too weak. Include uppercase, numbers, or symbols.', 'error'); return; }
    if (pw !== confirm) { showToast('Passwords do not match', 'error'); return; }
    setLoading(true);
    try {
      await client.post('/auth/reset-password', { resetToken, password: pw });
      showToast('Password updated successfully!', 'success');
      navigate('/login');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to reset password.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gk-auth-bg p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-elevated w-full max-w-md p-8 sm:p-10 border border-white/60 animate-[fadeIn_0.4s_ease-out]">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-4">
            <Icon name="refresh" className="w-7 h-7 text-forest-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Reset Password</h2>
          <p className="text-gray-500 text-sm mt-1">Enter and confirm your new password</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><Icon name="lock" className="w-4.5 h-4.5" /></div>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} className="gk-input pl-11" placeholder="Minimum 8 characters" />
            </div>
            {pw && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${strength.color} transition-all rounded-full`} style={{ width: strength.width }} /></div>
                <span className="text-xs text-gray-500 font-medium">{strength.text}</span>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><Icon name="lock" className="w-4.5 h-4.5" /></div>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="gk-input pl-11" placeholder="Re-enter your password" />
            </div>
            {confirm && confirm !== pw && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><Icon name="exclamation" className="w-3.5 h-3.5" />Passwords do not match</p>}
          </div>
          <button type="submit" disabled={loading} className="gk-btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">{loading ? <><Icon name="spinner" className="w-4 h-4 animate-spin" />Resetting…</> : 'Set New Password'}</button>
        </form>

        <p className="text-sm text-gray-500 text-center mt-6">Back to <Link to="/login" className="text-forest-500 hover:text-forest-600 font-semibold transition-colors">Sign in</Link></p>
      </div>
    </div>
  );
}
