import { useState, useEffect } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { getUserByEmail, updateUser } from '../../api/users.js';
import { showToast } from '../../components/Toast.jsx';
import { getPasswordStrength } from '../../utils/passwordStrength.js';

export default function ResetPassword() {
  const { user: authUser } = useAuth();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const raw = localStorage.getItem('gk_reset_token');
      if (!raw) { navigate('/forgot-password'); return; }
      const token = JSON.parse(raw);
      if (!token.email || !token.expires || Date.now() > token.expires) {
        localStorage.removeItem('gk_reset_token');
        showToast('Reset link has expired. Please try again.', 'error');
        navigate('/forgot-password');
        return;
      }
      setEmail(token.email);
    } catch {
      navigate('/forgot-password');
    }
  }, [navigate]);

  if (authUser) return <Navigate to={authUser.role === 'applicant' ? '/student' : '/employee'} replace />;

  const strength = getPasswordStrength(pw);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) { showToast('Password must be at least 8 characters', 'error'); return; }
    if (strength.score < 3) { showToast('Password is too weak. Include uppercase, numbers, or symbols.', 'error'); return; }
    if (pw !== confirm) { showToast('Passwords do not match', 'error'); return; }
    const u = await getUserByEmail(email);
    if (!u) { showToast('User not found', 'error'); return; }
    await updateUser(u.id, { password: pw });
    localStorage.removeItem('gk_reset_token');
    showToast('Password updated successfully!', 'success');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forest-500 via-forest-600 to-forest-700 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <span className="text-4xl">🔄</span>
          <h2 className="text-2xl font-bold text-forest-500 mt-3">Reset Password</h2>
          <p className="text-gray-500 text-sm mt-1">Enter and confirm your new password</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none" placeholder="Minimum 8 characters" />
            {pw && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className={`h-full ${strength.color} transition-all`} style={{ width: strength.width }} /></div>
                <span className="text-xs text-gray-500">{strength.text}</span>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none" placeholder="Re-enter your password" />
            {confirm && confirm !== pw && <p className="text-red-500 text-xs mt-1">Passwords do not match</p>}
          </div>
          <button type="submit" className="w-full bg-gradient-to-r from-forest-500 to-forest-400 text-white font-semibold py-2.5 rounded-lg hover:from-gold-500 hover:to-gold-600 shadow-md btn-shimmer">Set New Password</button>
        </form>

        <p className="text-sm text-gray-500 text-center mt-6">Back to <Link to="/login" className="text-[#166534] font-medium">Sign in</Link></p>
      </div>
    </div>
  );
}
