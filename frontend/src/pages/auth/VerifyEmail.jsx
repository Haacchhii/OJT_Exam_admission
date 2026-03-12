import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { client } from '../../api/client.js';
import { showToast } from '../../components/Toast.jsx';
import Icon from '../../components/Icons.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { SCHOOL_NAME_SHORT, SCHOOL_NAME_SUBTITLE } from '../../utils/constants';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState('pending'); // pending | verifying | success | error
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // The email passed from Register/Login via navigation state
  const email = location.state?.email || '';

  // Check for token in URL query params (from email link)
  useEffect(() => {
    const params = new URLSearchParams(location.hash?.split('?')[1] || window.location.hash.split('?')[1] || '');
    const token = params.get('token');
    if (token) {
      setStatus('verifying');
      client.post('/auth/verify-email', { token })
        .then(async () => {
          setStatus('success');
          showToast('Email verified successfully!', 'success');
          // Refresh the user data so emailVerified is updated
          await refreshUser();
          setTimeout(() => navigate('/student', { replace: true }), 2000);
        })
        .catch(err => {
          setStatus('error');
          setError(err.message || 'Verification failed. The link may be expired.');
        });
    }
  }, [location, navigate, refreshUser]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (!email || resending || resendCooldown > 0) return;
    setResending(true);
    try {
      await client.post('/auth/resend-verification', { email });
      showToast('Verification email sent! Check your inbox.', 'success');
      setResendCooldown(60); // 60-second cooldown
    } catch (err) {
      showToast(err.message || 'Failed to resend. Please try again.', 'error');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gk-auth-bg p-6">
      <div className="w-full max-w-md animate-[fadeIn_0.4s_ease-out]">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Icon name="key" className="w-6 h-6 text-forest-800" />
          </div>
          <h1 className="text-lg font-bold text-gold-400">{SCHOOL_NAME_SHORT}</h1>
          <p className="text-sm text-forest-300 font-semibold">{SCHOOL_NAME_SUBTITLE}</p>
        </div>

        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-elevated p-8 sm:p-10 border border-white/60">
          {status === 'verifying' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <Icon name="spinner" className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Verifying Your Email...</h2>
              <p className="text-gray-500 text-sm">Please wait while we confirm your email address.</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <Icon name="check" className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Email Verified!</h2>
              <p className="text-gray-500 text-sm mb-4">Your email has been verified successfully. Redirecting you to the portal...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Icon name="exclamation" className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Verification Failed</h2>
              <p className="text-red-500 text-sm mb-6">{error}</p>
              {email && (
                <button
                  onClick={handleResend}
                  disabled={resending || resendCooldown > 0}
                  className="gk-btn-primary w-full py-3 text-sm disabled:opacity-60"
                >
                  {resending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification Email'}
                </button>
              )}
              <Link to="/login" className="block text-sm text-forest-500 hover:text-forest-600 font-semibold mt-4">
                Back to Login
              </Link>
            </div>
          )}

          {status === 'pending' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Check Your Email</h2>
              <p className="text-gray-500 text-sm mb-2">
                We've sent a verification link to:
              </p>
              {email && (
                <p className="text-forest-600 font-semibold text-sm mb-6">{email}</p>
              )}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
                <p className="text-amber-800 text-sm font-medium mb-2">Next steps:</p>
                <ol className="text-amber-700 text-sm space-y-1 list-decimal list-inside">
                  <li>Open the email from Golden Key</li>
                  <li>Click the "Verify My Email" button</li>
                  <li>You'll be redirected back here automatically</li>
                </ol>
              </div>
              <p className="text-gray-400 text-xs mb-4">Didn't receive the email? Check your spam folder or click below to resend.</p>
              <button
                onClick={handleResend}
                disabled={resending || resendCooldown > 0 || !email}
                className="gk-btn-primary w-full py-3 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {resending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification Email'}
              </button>
              <Link to="/login" className="block text-sm text-forest-500 hover:text-forest-600 font-semibold mt-4 transition-colors">
                Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
