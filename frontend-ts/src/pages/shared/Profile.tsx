import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../components/Toast';
import Icon from '../../components/Icons';
import { PageHeader } from '../../components/UI';
import { client } from '../../api/client';

export default function Profile() {
  const { user, refreshUser } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  if (!user) return null;

  const isEmployee = user.role !== 'applicant';
  const initials = `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase();

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      showToast('First name and last name are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      await client.patch('/auth/profile', { firstName: firstName.trim(), lastName: lastName.trim() });
      await refreshUser();
      showToast('Profile updated successfully!', 'success');
    } catch (err) {
      showToast((err as Error).message || 'Failed to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      showToast('Current password is required.', 'error');
      return;
    }
    if (!newPassword) {
      showToast('New password is required.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    setChangingPassword(true);
    try {
      await client.patch('/auth/profile', { currentPassword, newPassword });
      showToast('Password changed successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showToast((err as Error).message || 'Failed to change password.', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div>
      <PageHeader title="My Profile" subtitle="View and update your account information." />

      <div className="max-w-2xl space-y-6">
        {/* Profile Card */}
        <div className="gk-card p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold shadow-sm ${isEmployee ? 'bg-forest-500 text-gold-300' : 'bg-gold-400 text-forest-700'}`}>
              {initials}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">{user.firstName} {user.lastName}</h2>
              <p className="text-sm text-gray-500">{user.email}</p>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize bg-forest-100 text-forest-700">
                {user.role === 'applicant' ? 'Student' : user.role}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400 text-xs uppercase font-semibold">Account Created</span>
              <p className="text-gray-700 mt-0.5">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</p>
            </div>
            <div>
              <span className="text-gray-400 text-xs uppercase font-semibold">Status</span>
              <p className="text-gray-700 mt-0.5">{user.status || 'Active'}</p>
            </div>
            {user.applicantProfile?.studentNumber && (
              <div>
                <span className="text-gray-400 text-xs uppercase font-semibold">Student Number</span>
                <p className="text-gray-700 mt-0.5">{user.applicantProfile.studentNumber}</p>
              </div>
            )}
            {user.applicantProfile?.lrn && (
              <div>
                <span className="text-gray-400 text-xs uppercase font-semibold">LRN</span>
                <p className="text-gray-700 mt-0.5">{user.applicantProfile.lrn}</p>
              </div>
            )}
          </div>
        </div>

        {/* Edit Name */}
        <div className="gk-card p-6">
          <h3 className="text-md font-bold text-forest-500 mb-4 flex items-center gap-2">
            <Icon name="userCircle" className="w-5 h-5" />
            Edit Name
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm" />
            </div>
          </div>
          <button onClick={handleSaveProfile} disabled={saving} className="bg-forest-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-forest-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 text-sm">
            {saving ? <><Icon name="spinner" className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Changes'}
          </button>
        </div>

        {/* Change Password */}
        <div className="gk-card p-6">
          <h3 className="text-md font-bold text-forest-500 mb-4 flex items-center gap-2">
            <Icon name="shieldCheck" className="w-5 h-5" />
            Change Password
          </h3>
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm" />
            </div>
          </div>
          <button onClick={handleChangePassword} disabled={changingPassword} className="bg-forest-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-forest-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 text-sm">
            {changingPassword ? <><Icon name="spinner" className="w-4 h-4 animate-spin" /> Changing…</> : 'Change Password'}
          </button>
        </div>
      </div>
    </div>
  );
}
