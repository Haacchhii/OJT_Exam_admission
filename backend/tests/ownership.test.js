import { describe, expect, it } from 'vitest';

import { applicantRegistrationOwnershipWhere } from '../src/utils/ownership.js';

describe('applicant registration ownership queries', () => {
  it('only falls back to email for legacy registrations without a linked user', () => {
    expect(applicantRegistrationOwnershipWhere({ id: 901, email: ' Applicant@Example.com ' })).toEqual({
      OR: [
        { userId: 901 },
        {
          userId: null,
          userEmail: { equals: 'applicant@example.com', mode: 'insensitive' },
        },
      ],
    });
  });
});
