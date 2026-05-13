import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth, getPostAuthRoute } from '../../context/AuthContext';
import { client } from '../../api/client';
import { showToast } from '../../components/Toast';
import { getPasswordStrength, getPasswordRequirementChecks } from '../../utils/passwordStrength';
import { ActionButton } from '../../components/UI';
import Icon from '../../components/Icons';

export default function ChangePassword() {
  const { user: authUser, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (authUser && !authUser.mustChangePassword) {
      navigate(getPostAuthRoute(authUser), { replace: true });
    }
  }, [authUser, navigate]);

  if (!authUser) return <Navigate to="/login" replace />;
  if (!authUser.mustChangePassword) return <Navigate to={getPostAuthRoute(authUser)} replace />;

  const strength = getPasswordStrength(newPassword);
  const requirementChecks = getPasswordRequirementChecks(newPassword);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPassword.trim()) {
      showToast('Enter the temporary password you received.', 'error');
      return;
    }
    if (newPassword.length < 8) {
      showToast('Password must be at least 8 characters.', 'error');
      return;
    }
    if (strength.score < 3) {
      showToast('Password is too weak. Include uppercase, numbers, or symbols.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    setLoading(true);
    try {
      await client.patch('/auth/profile', {
        currentPassword,
        newPassword,
      });
      logout();
      showToast('Password changed successfully. Please sign in with your new password.', 'success');
      navigate('/login', { replace: true });
    } catch (err) {
      showToast((err as Error).message || 'Failed to change password.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gk-auth-bg p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-elevated w-full max-w-md p-8 sm:p-10 border border-white/60 animate-[fadeIn_0.4s_ease-out]">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-4">
            <Icon name="shieldCheck" className="w-7 h-7 text-forest-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Change Your Password</h2>
          <p className="text-gray-500 text-sm mt-1">Use the temporary password from your email, then set a permanent one.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Temporary Password</label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <Icon name="lock" className="w-4.5 h-4.5" />
              </div>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="gk-input pl-11 pr-12"
                placeholder="Enter your temporary password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label={showCurrent ? 'Hide temporary password' : 'Show temporary password'}
              >
                <Icon name={showCurrent ? 'eyeOff' : 'eye'} className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <Icon name="lock" className="w-4.5 h-4.5" />
              </div>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="gk-input pl-11 pr-12"
                placeholder="Create a new password"
              />
              <button
                type="button"
                onClick={() => setShowNew((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label={showNew ? 'Hide new password' : 'Show new password'}
              >
                <Icon name={showNew ? 'eyeOff' : 'eye'} className="w-4.5 h-4.5" />
              </button>
            </div>
            {newPassword && (
              <>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${strength.color} transition-all rounded-full`} style={{ width: strength.width }} />
                  </div>
                  <span className="text-xs text-gray-500 font-medium">{strength.text}</span>
                </div>
                <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5 space-y-1.5">
                  {requirementChecks.map((rule) => (
                    <p key={rule.key} className={`text-sm flex items-center gap-1.5 ${rule.met ? 'text-emerald-700' : 'text-gray-600'}`}>
                      <Icon name={rule.met ? 'checkCircle' : 'xCircle'} className="w-3.5 h-3.5" />
                      {rule.label}
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <Icon name="lock" className="w-4.5 h-4.5" />
              </div>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="gk-input pl-11 pr-12"
                placeholder="Re-enter your new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}
              >
                <Icon name={showConfirm ? 'eyeOff' : 'eye'} className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          <ActionButton type="submit" loading={loading} className="w-full py-3 text-sm">
            {loading ? 'Updating...' : 'Save New Password'}
          </ActionButton>
        </form>
      </div>
    </div>
  );
}
