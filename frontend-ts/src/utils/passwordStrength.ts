interface PasswordStrength {
  score: number;
  text: string;
  color: string;
  width: string;
}

export interface PasswordRequirementCheck {
  key: 'minLength' | 'uppercase' | 'lowercase' | 'digit' | 'special';
  label: string;
  met: boolean;
}

export function getPasswordRequirementChecks(password: string): PasswordRequirementCheck[] {
  const value = password || '';
  return [
    { key: 'minLength', label: 'At least 8 characters', met: value.length >= 8 },
    { key: 'uppercase', label: 'At least one uppercase letter', met: /[A-Z]/.test(value) },
    { key: 'lowercase', label: 'At least one lowercase letter', met: /[a-z]/.test(value) },
    { key: 'digit', label: 'At least one number', met: /[0-9]/.test(value) },
    { key: 'special', label: 'At least one special character', met: /[^A-Za-z0-9]/.test(value) },
  ];
}

export function isPasswordCompliant(password: string): boolean {
  return getPasswordRequirementChecks(password).every(rule => rule.met);
}

export function getPasswordStrength(password: string): PasswordStrength {
  const v = password || '';
  let s = 0;
  if (v.length >= 8) s++;
  if (v.length >= 12) s++;
  if (/[A-Z]/.test(v)) s++;
  if (/[0-9]/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  const levels = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const colors = ['bg-gray-200', 'bg-red-500', 'bg-gold-500', 'bg-gold-500', 'bg-forest-500', 'bg-forest-500'];
  return { score: s, text: levels[s], color: colors[s], width: `${s * 20}%` };
}
