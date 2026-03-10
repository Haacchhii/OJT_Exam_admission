interface PasswordStrength {
  score: number;
  text: string;
  color: string;
  width: string;
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
