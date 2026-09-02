function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function applicantOwnsRegistration(registration, user) {
  if (!registration || !user) return false;
  if (registration.userId != null) return registration.userId === user.id;

  const registrationEmail = normalizeEmail(registration.userEmail);
  const userEmail = normalizeEmail(user.email);
  return Boolean(registrationEmail && userEmail && registrationEmail === userEmail);
}
