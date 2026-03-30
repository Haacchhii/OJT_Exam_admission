import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { client } from '../../api/client';
import { showToast } from '../../components/Toast';
import Icon from '../../components/Icons';

type VerifyState = 'verifying' | 'success' | 'error';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [state, setState] = useState<VerifyState>('verifying');
  const [message, setMessage] = useState('Verifying your email. Please wait...');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    let active = true;

    const token = params.get('token');
    const emailHint = params.get('email');
    if (emailHint) setResendEmail(emailHint);
    if (!token) {
      setState('error');
      setMessage('Missing verification token. Please request a new verification email.');
      return;
    }

    (async () => {
      try {
        const res = await client.post<{ ok?: boolean; message?: string }>('/auth/verify-email', { token });
        if (!active) return;
        setState('success');
        setMessage(res?.message || 'Email verified successfully. You can now sign in.');
        showToast('Email verified successfully!', 'success');
      } catch (err: unknown) {
        if (!active) return;
        const msg = (err as Error).message || 'Verification failed. Please request a new verification link.';
        setState('error');
        setMessage(msg);
        showToast(msg, 'error');
      }
    })();

    return () => {
      active = false;
    };
  }, [params]);

  const handleResend = async () => {
    const email = resendEmail.trim();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      showToast('Enter a valid email address to resend verification.', 'error');
      return;
    }
    setResending(true);
    try {
      const res = await client.post<{ message?: string }>('/auth/resend-verification', { email });
      showToast(res?.message || 'Verification email sent.', 'success');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to resend verification email.', 'error');
    } finally {
      setResending(false);
    }
  };

  const icon =
    state === 'verifying'
      ? <Icon name="spinner" className="w-7 h-7 text-forest-500 animate-spin" />
      : state === 'success'
        ? <Icon name="checkCircle" className="w-7 h-7 text-forest-500" />
        : <Icon name="xCircle" className="w-7 h-7 text-red-500" />;

  const title =
    state === 'verifying' ? 'Verifying Email' : state === 'success' ? 'Email Verified' : 'Verification Failed';

  return (
    <div className="min-h-screen flex items-center justify-center gk-auth-bg p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-elevated w-full max-w-md p-8 sm:p-10 border border-white/60 animate-[fadeIn_0.4s_ease-out]">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-4">
            {icon}
          </div>
          <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
          <p className="text-gray-500 text-sm mt-2">{message}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link to="/login" className="gk-btn-primary px-5 py-2.5 text-sm">
            Go to Login
          </Link>
          {state === 'error' && (
            <>
              <Link to="/register" className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm hover:bg-gray-50">
                Back to Register
              </Link>
              <div className="w-full mt-3 text-left">
                <label className="text-xs text-gray-500 mb-1 block" htmlFor="resend-email">Resend verification</label>
                <div className="flex gap-2">
                  <input
                    id="resend-email"
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-forest-500/20 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="border border-forest-300 text-forest-700 px-3 py-2 rounded-lg text-sm hover:bg-forest-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resending ? 'Sending...' : 'Resend'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
