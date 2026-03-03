import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { addUser, getUserByEmail } from '../../api/users.js';
import { showToast } from '../../components/Toast.jsx';
import Modal from '../../components/Modal.jsx';
import { getPasswordStrength } from '../../utils/passwordStrength.js';

export default function Register() {
  const { user } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={user.role === 'applicant' ? '/student' : '/employee'} replace />;

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const strength = getPasswordStrength(form.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { showToast('Password must be at least 8 characters.', 'error'); return; }
    if (strength.score < 3) { showToast('Password is too weak. Include uppercase, numbers, or symbols.', 'error'); return; }
    if (form.password !== form.confirmPassword) { showToast('Passwords do not match', 'error'); return; }
    if (!/\S+@\S+\.\S+/.test(form.email)) { showToast('Please enter a valid email address.', 'error'); return; }
    if (await getUserByEmail(form.email)) { showToast('Email already registered.', 'error'); return; }
    setLoading(true);
    try {
      const result = await addUser({ firstName: form.firstName, lastName: form.lastName, email: form.email, role: 'applicant', password: form.password });
      if (result?.error) { showToast(result.error, 'error'); return; }
      setSuccess(true);
    } catch (err) {
      showToast(err.message || 'Registration failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forest-500 via-forest-600 to-forest-700 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <span className="text-4xl">🔑</span>
          <h1 className="text-xl font-bold text-forest-500 mt-2">GOLDEN KEY Integrated School of St. Joseph</h1>
        </div>
        <h2 className="text-2xl font-bold text-forest-500 mb-1">Create Account</h2>
        <p className="text-gray-500 text-sm mb-6">Register as a new applicant to get started</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input type="text" value={form.firstName} onChange={set('firstName')} required className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none" placeholder="Juan" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input type="text" value={form.lastName} onChange={set('lastName')} required className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none" placeholder="Dela Cruz" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={set('email')} required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none" placeholder="your@email.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} required minLength={8} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none" placeholder="Create a password" />
            {form.password && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className={`h-full ${strength.color} transition-all`} style={{ width: strength.width }} /></div>
                <span className="text-xs text-gray-500">{strength.text}</span>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <div className="relative">
              <input type={showConfirmPw ? 'text' : 'password'} value={form.confirmPassword} onChange={set('confirmPassword')} required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none pr-12" placeholder="Re-enter your password" />
              <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showConfirmPw ? '🙈' : '👁'}
              </button>
            </div>
            {form.confirmPassword && form.confirmPassword !== form.password && <p className="text-red-500 text-xs mt-1">Passwords do not match</p>}
          </div>
          <button type="submit" disabled={loading} data-testid="register-submit" className="w-full bg-gradient-to-r from-forest-500 to-forest-400 text-white font-semibold py-2.5 rounded-lg hover:from-gold-500 hover:to-gold-600 shadow-md btn-shimmer disabled:opacity-60 disabled:cursor-not-allowed">{loading ? 'Creating Account…' : 'Create Account'}</button>
        </form>
        <p className="text-sm text-gray-500 text-center mt-6">Already have an account? <Link to="/login" className="text-[#166534] font-medium">Sign in</Link></p>
      </div>

      <Modal open={success} onClose={() => setSuccess(false)}>
        <div className="text-center">
          <span className="text-4xl">✅</span>
          <h3 className="text-xl font-bold text-forest-500 mt-4">Account Created!</h3>
          <p className="text-gray-500 mt-2">Your account has been registered. You can now log in.</p>
          <Link to="/login" className="mt-4 inline-block bg-[#166534] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[#14532d]">Go to Login</Link>
        </div>
      </Modal>
    </div>
  );
}
