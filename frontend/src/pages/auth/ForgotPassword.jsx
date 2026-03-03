import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { getUserByEmail } from '../../api/users.js';
import { showToast } from '../../components/Toast.jsx';

export default function ForgotPassword() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const navigate = useNavigate();
  if (user) return <Navigate to={user.role === 'applicant' ? '/student' : '/employee'} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const u = await getUserByEmail(email);
    if (!u) { showToast('No account found with this email.', 'error'); return; }
    // Generate a simple time-limited reset token (in production, backend sends email with real token)
    const token = btoa(`${email}:${Date.now()}`);
    localStorage.setItem('gk_reset_token', JSON.stringify({ email, token, expires: Date.now() + 15 * 60 * 1000 }));
    showToast('Email verified! You may now reset your password.', 'success');
    navigate('/reset-password');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forest-500 via-forest-600 to-forest-700 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <span className="text-4xl">🔐</span>
          <h2 className="text-2xl font-bold text-forest-500 mt-3">Forgot Password</h2>
          <p className="text-gray-500 text-sm mt-1">Enter your registered email to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none" placeholder="your@email.com" />
          </div>
          <button type="submit" className="w-full bg-gradient-to-r from-forest-500 to-forest-400 text-white font-semibold py-2.5 rounded-lg hover:from-gold-500 hover:to-gold-600 shadow-md btn-shimmer">Verify Email</button>
        </form>

        <p className="text-sm text-gray-500 text-center mt-6">Back to <Link to="/login" className="text-[#166534] font-medium">Sign in</Link></p>
      </div>
    </div>
  );
}
