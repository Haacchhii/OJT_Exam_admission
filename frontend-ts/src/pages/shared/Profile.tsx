import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../components/Toast';
import Icon from '../../components/Icons';
import { PageHeader, ActionButton } from '../../components/UI';
import { client } from '../../api/client';
import { formatPersonName, personInitials } from '../../utils/helpers';

// Validation patterns (must match backend validation)
const NAME_REGEX = /^[\p{L}\p{M}\s\-'.]+$/u;
const PHONE_REGEX = /^[+\d][\d\s()-]{6,}$/;
const ADDRESS_REGEX = /^[\p{L}\p{M}\p{N}\s\-'.,/()]+$/u;
const PASSWORD_PATTERNS = {
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  digit: /[0-9]/,
  special: /[^A-Za-z0-9]/,
};

interface ValidationErrors {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export default function Profile() {
  const { user, refreshUser } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [middleName, setMiddleName] = useState(user?.middleName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  if (!user) return null;

  const isEmployee = user.role !== 'applicant';
  const initials = personInitials(user);

  const validateProfile = (): boolean => {
    const e: ValidationErrors = {};

    if (!firstName.trim()) e.firstName = 'First name is required';
    else if (firstName.trim().length < 2) e.firstName = 'At least 2 characters';
    else if (!NAME_REGEX.test(firstName.trim())) e.firstName = 'Use only letters, spaces, hyphens, or apostrophes';
    else if (firstName.trim().length > 100) e.firstName = 'Maximum 100 characters';

    if (!middleName.trim()) e.middleName = 'Middle name is required';
    else if (middleName.trim().length < 2) e.middleName = 'At least 2 characters';
    else if (!NAME_REGEX.test(middleName.trim())) e.middleName = 'Use only letters, spaces, hyphens, or apostrophes';
    else if (middleName.trim().length > 100) e.middleName = 'Maximum 100 characters';

    if (!lastName.trim()) e.lastName = 'Last name is required';
    else if (lastName.trim().length < 2) e.lastName = 'At least 2 characters';
    else if (!NAME_REGEX.test(lastName.trim())) e.lastName = 'Use only letters, spaces, hyphens, or apostrophes';
    else if (lastName.trim().length > 100) e.lastName = 'Maximum 100 characters';

    if (phone.trim() && !PHONE_REGEX.test(phone.trim())) {
      e.phone = 'Invalid phone format';
    } else if (phone.trim() && phone.trim().length > 20) {
      e.phone = 'Maximum 20 characters';
    }

    if (address.trim() && !ADDRESS_REGEX.test(address.trim())) {
      e.address = 'Contains invalid characters';
    } else if (address.trim() && address.trim().length > 500) {
      e.address = 'Maximum 500 characters';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validatePassword = (): boolean => {
    const e: ValidationErrors = {};

    if (!newPassword) {
      e.newPassword = 'New password is required';
    } else {
      if (newPassword.length < 8) e.newPassword = 'Minimum 8 characters';
      else if (!PASSWORD_PATTERNS.uppercase.test(newPassword)) e.newPassword = 'Must contain uppercase letter';
      else if (!PASSWORD_PATTERNS.lowercase.test(newPassword)) e.newPassword = 'Must contain lowercase letter';
      else if (!PASSWORD_PATTERNS.digit.test(newPassword)) e.newPassword = 'Must contain number';
      else if (!PASSWORD_PATTERNS.special.test(newPassword)) e.newPassword = 'Must contain special character';
    }

    if (!confirmPassword) {
      e.confirmPassword = 'Confirmation is required';
    } else if (newPassword !== confirmPassword) {
      e.confirmPassword = 'Passwords do not match';
    }

    setErrors((prev) => ({ ...prev, ...e }));
    return Object.keys(e).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateProfile()) return;

    setSaving(true);
    try {
      await client.patch('/auth/profile', {
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });
      await refreshUser();
      setErrors({});
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
    if (!validatePassword()) return;

    setChangingPassword(true);
    try {
      await client.patch('/auth/profile', { currentPassword, newPassword });
      showToast('Password changed successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
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
        <div className="gk-section-card p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold shadow-sm ${isEmployee ? 'bg-forest-500 text-gold-300' : 'bg-gold-400 text-forest-700'}`}>
              {initials}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">{formatPersonName(user)}</h2>
              <p className="text-sm text-gray-500">{user.email}</p>
              <span className="gk-badge gk-badge-active mt-1 capitalize">
                {user.role === 'applicant' ? 'Student' : user.role}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400 text-xs uppercase font-semibold">Account Created</span>
              <p className="text-gray-700 mt-0.5">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}</p>
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

        {/* Edit Profile */}
        <div className="gk-section-card p-6">
          <h3 className="text-md font-bold text-forest-500 mb-4 flex items-center gap-2">
            <Icon name="userCircle" className="w-5 h-5" />
            Edit Profile
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm ${errors.firstName ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />
              {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
              <input type="text" value={middleName} onChange={e => setMiddleName(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm ${errors.middleName ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />
              {errors.middleName && <p className="text-xs text-red-600 mt-1">{errors.middleName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Surname</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm ${errors.lastName ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />
              {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 09171234567" className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm ${errors.phone ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />
              {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Street, City, Province" className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm ${errors.address ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />
              {errors.address && <p className="text-xs text-red-600 mt-1">{errors.address}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={user.email} disabled className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-500 cursor-not-allowed" />
              <p className="text-xs text-gray-400 mt-0.5">Email cannot be changed.</p>
            </div>
          </div>
          <ActionButton onClick={handleSaveProfile} loading={saving} className="text-sm">
            {saving ? 'Saving...' : 'Save Changes'}
          </ActionButton>
        </div>

        {/* Change Password */}
        <div className="gk-section-card p-6">
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
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm ${errors.newPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />
              {errors.newPassword && <p className="text-xs text-red-600 mt-1">{errors.newPassword}</p>}
              <p className="text-xs text-gray-500 mt-1">Min 8 chars, uppercase, lowercase, number, special char</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm ${errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />
              {errors.confirmPassword && <p className="text-xs text-red-600 mt-1">{errors.confirmPassword}</p>}
            </div>
          </div>
          <ActionButton onClick={handleChangePassword} loading={changingPassword} className="text-sm">
            {changingPassword ? 'Changing...' : 'Change Password'}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
