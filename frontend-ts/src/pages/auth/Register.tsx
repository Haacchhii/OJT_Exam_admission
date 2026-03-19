import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../components/Toast';
import { getPasswordStrength } from '../../utils/passwordStrength';
import Icon from '../../components/Icons';
import { SCHOOL_NAME, SCHOOL_BRAND, SCHOOL_SUBTITLE, GRADE_OPTIONS } from '../../utils/constants';

export default function Register() {
  const gradeStages = GRADE_OPTIONS.map(g => g.group);
  const gradeOptionsByStage = Object.fromEntries(GRADE_OPTIONS.map(g => [g.group, g.items])) as Record<string, string[]>;

  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', gradeLevel: '' });
  const [gradeStage, setGradeStage] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={user.role === 'applicant' ? '/student' : '/employee'} replace />;

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const strength = getPasswordStrength(form.password);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { showToast('Password must be at least 8 characters.', 'error'); return; }
    if (strength.score < 3) { showToast('Password is too weak. Include uppercase, numbers, or symbols.', 'error'); return; }
    if (form.password !== form.confirmPassword) { showToast('Passwords do not match', 'error'); return; }
    if (!/\S+@\S+\.\S+/.test(form.email)) { showToast('Please enter a valid email address.', 'error'); return; }
    if (!form.gradeLevel) { showToast('Please select your grade level.', 'error'); return; }
    setLoading(true);
    try {
      const result = await login(form.email, form.password, {
        registerPayload: { firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password, gradeLevel: form.gradeLevel },
      });
      if (!result.ok) {
        if (result.emailVerificationRequired) {
          showToast(result.msg || 'Verification email sent. Please check your inbox and spam folder.', 'info');
          return;
        }
        showToast(result.msg || 'Registration failed. Please try again.', 'error');
        return;
      }
      showToast('Account created! Welcome aboard.', 'success');
      navigate('/student');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Registration failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex gk-auth-bg">
      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 text-white overflow-hidden">
        <div className="absolute top-20 -left-16 w-64 h-64 bg-gold-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-32 right-0 w-48 h-48 bg-white/5 rounded-full blur-2xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center shadow-lg">
              <Icon name="key" className="w-5 h-5 text-forest-800" />
            </div>
            <span className="text-lg font-bold tracking-tight text-gold-400">{SCHOOL_BRAND}</span>
          </div>
          <p className="text-forest-300 text-sm font-semibold">{SCHOOL_SUBTITLE}</p>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-bold leading-tight">
            Start Your<br />
            <span className="text-gold-400">Journey Today</span>
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-sm">
            Join our community of learners. Register to apply for admission and take entrance exams online.
          </p>
          <div className="space-y-4 pt-2">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-widest">How it works</p>
            {[
              { step: '1', label: 'Create your account', desc: 'Register with your name and email — takes less than a minute.' },
              { step: '2', label: 'Book & take the entrance exam', desc: 'Choose a schedule and complete the online entrance exam.' },
              { step: '3', label: 'Submit your admission application', desc: 'Once you pass, fill out the admission form and upload your documents.' },
            ].map(({ step, label, desc }) => (
              <div key={step} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-gold-400/20 border border-gold-400/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-gold-400 text-xs font-bold">{step}</span>
                </div>
                <div>
                  <p className="text-white/80 text-sm font-semibold">{label}</p>
                  <p className="text-white/40 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/30">&copy; {new Date().getFullYear()} {SCHOOL_NAME}. All rights reserved.</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md animate-[fadeIn_0.4s_ease-out]">
          <div className="lg:hidden text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center mx-auto mb-3 shadow-lg">
              <Icon name="key" className="w-6 h-6 text-forest-800" />
            </div>
            <h1 className="text-lg font-bold text-gold-400">{SCHOOL_BRAND}</h1>
            <p className="text-sm text-forest-300 font-semibold">{SCHOOL_SUBTITLE}</p>
          </div>

          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-elevated p-8 sm:p-10 border border-white/60">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-800">Create Account</h2>
              <p className="text-gray-500 text-sm mt-1">Register as a new applicant to get started</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name</label>
                  <input type="text" value={form.firstName} onChange={set('firstName')} required className="gk-input" placeholder="Juan" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
                  <input type="text" value={form.lastName} onChange={set('lastName')} required className="gk-input" placeholder="Dela Cruz" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <Icon name="mail" className="w-4.5 h-4.5" />
                  </div>
                  <input type="email" value={form.email} onChange={set('email')} required className="gk-input pl-11" placeholder="your@email.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">School Stage</label>
                <select
                  value={gradeStage}
                  onChange={e => {
                    const nextStage = e.target.value;
                    setGradeStage(nextStage);
                    setForm(f => ({ ...f, gradeLevel: '' }));
                  }}
                  required
                  className="gk-input"
                >
                  <option value="">Select school stage</option>
                  {gradeStages.map(stage => <option key={stage} value={stage}>{stage}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Applying for Grade Level</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <Icon name="academicCap" className="w-4.5 h-4.5" />
                  </div>
                  <select value={form.gradeLevel} onChange={set('gradeLevel')} required disabled={!gradeStage} className="gk-input pl-11 appearance-none cursor-pointer disabled:bg-gray-50 disabled:text-gray-400">
                    <option value="">{gradeStage ? 'Select your grade level' : 'Select stage first'}</option>
                    {(gradeOptionsByStage[gradeStage] || []).map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <Icon name="lock" className="w-4.5 h-4.5" />
                  </div>
                  <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} required minLength={8} className="gk-input pl-11 pr-12" placeholder="Create a password" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" aria-label={showPw ? 'Hide password' : 'Show password'}>
                    <Icon name={showPw ? 'eyeOff' : 'eye'} className="w-4.5 h-4.5" />
                  </button>
                </div>
                {form.password && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${strength.color} transition-all rounded-full`} style={{ width: strength.width }} /></div>
                    <span className="text-xs text-gray-500 font-medium">{strength.text}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <Icon name="lock" className="w-4.5 h-4.5" />
                  </div>
                  <input type={showConfirmPw ? 'text' : 'password'} value={form.confirmPassword} onChange={set('confirmPassword')} required className="gk-input pl-11 pr-12" placeholder="Re-enter your password" />
                  <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" aria-label={showConfirmPw ? 'Hide password' : 'Show password'}>
                    <Icon name={showConfirmPw ? 'eyeOff' : 'eye'} className="w-4.5 h-4.5" />
                  </button>
                </div>
                {form.confirmPassword && form.confirmPassword !== form.password && (
                  <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><Icon name="exclamation" className="w-3.5 h-3.5" />Passwords do not match</p>
                )}
              </div>
              <button type="submit" disabled={loading} data-testid="register-submit" className="gk-btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                {loading ? (
                  <><Icon name="spinner" className="w-4 h-4 animate-spin" />Creating Account…</>
                ) : 'Create Account'}
              </button>
            </form>
            <p className="text-sm text-gray-500 text-center mt-6">Already have an account? <Link to="/login" className="text-forest-500 hover:text-forest-600 font-semibold transition-colors">Sign in</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
