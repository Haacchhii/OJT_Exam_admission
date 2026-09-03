function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function canAccessAdmissionDocuments(user) {
  return ['admin', 'registrar', 'applicant'].includes(String(user?.role || '').toLowerCase());
}

export function applicantOwnsRegistration(registration, user) {
  if (!registration || !user) return false;
  if (registration.userId != null) return registration.userId === user.id;

  const registrationEmail = normalizeEmail(registration.userEmail);
  const userEmail = normalizeEmail(user.email);
  return Boolean(registrationEmail && userEmail && registrationEmail === userEmail);
}

export function applicantRegistrationOwnershipWhere(user) {
  return {
    OR: [
      { userId: user.id },
      {
        userId: null,
        userEmail: { equals: normalizeEmail(user.email), mode: 'insensitive' },
      },
    ],
  };
}
