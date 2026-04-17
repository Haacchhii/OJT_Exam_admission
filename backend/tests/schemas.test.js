import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  bulkUpdateStatusSchema,
  createExamSchema,
  saveDraftSchema,
  submitExamSchema,
} from '../src/utils/schemas.js';

describe('loginSchema', () => {
  it('accepts valid email and password', () => {
    expect(() => loginSchema.parse({ email: 'a@b.com', password: 'x' })).not.toThrow();
  });

  it('rejects missing email', () => {
    expect(() => loginSchema.parse({ password: 'x' })).toThrow();
  });

  it('rejects invalid email format', () => {
    expect(() => loginSchema.parse({ email: 'bad', password: 'x' })).toThrow();
  });
});

describe('registerSchema', () => {
  const valid = { firstName: 'John', middleName: 'Lee', lastName: 'Doe', email: 'john@example.com', password: 'Str0ng!Pass', gradeLevel: 'Grade 7' };

  it('accepts valid registration', () => {
    expect(() => registerSchema.parse(valid)).not.toThrow();
  });

  it('rejects weak password (no uppercase)', () => {
    expect(() => registerSchema.parse({ ...valid, password: 'str0ng!pass' })).toThrow(/uppercase/);
  });

  it('rejects weak password (no number)', () => {
    expect(() => registerSchema.parse({ ...valid, password: 'Strong!Pass' })).toThrow(/number/);
  });

  it('rejects weak password (no special char)', () => {
    expect(() => registerSchema.parse({ ...valid, password: 'Str0ngPassw' })).toThrow(/special/);
  });

  it('rejects short password', () => {
    expect(() => registerSchema.parse({ ...valid, password: 'Ab1!' })).toThrow(/8 char/);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    expect(() => forgotPasswordSchema.parse({ email: 'a@b.com' })).not.toThrow();
  });
});

describe('resetPasswordSchema', () => {
  it('requires token and valid password', () => {
    expect(() => resetPasswordSchema.parse({ resetToken: 'tok', password: 'StrOng1!x' })).not.toThrow();
  });

  it('rejects missing token', () => {
    expect(() => resetPasswordSchema.parse({ password: 'StrOng1!x' })).toThrow();
  });
});

describe('bulkUpdateStatusSchema', () => {
  it('accepts valid ids and status', () => {
    expect(() => bulkUpdateStatusSchema.parse({ ids: [1, 2, 3], status: 'Accepted' })).not.toThrow();
  });

  it('rejects more than 100 ids', () => {
    const ids = Array.from({ length: 101 }, (_, i) => i + 1);
    expect(() => bulkUpdateStatusSchema.parse({ ids, status: 'Accepted' })).toThrow();
  });

  it('rejects invalid status', () => {
    expect(() => bulkUpdateStatusSchema.parse({ ids: [1], status: 'Invalid' })).toThrow();
  });

  it('rejects empty ids', () => {
    expect(() => bulkUpdateStatusSchema.parse({ ids: [], status: 'Accepted' })).toThrow();
  });
});

describe('createExamSchema', () => {
  it('accepts valid exam', () => {
    expect(() => createExamSchema.parse({
      title: 'Math Test',
      gradeLevel: 'Grade 7',
      durationMinutes: 60,
      passingScore: 75,
    })).not.toThrow();
  });

  it('rejects missing title', () => {
    expect(() => createExamSchema.parse({
      gradeLevel: 'Grade 7',
      durationMinutes: 60,
      passingScore: 75,
    })).toThrow();
  });

  it('rejects passingScore > 100', () => {
    expect(() => createExamSchema.parse({
      title: 'Test',
      gradeLevel: 'Grade 7',
      durationMinutes: 60,
      passingScore: 150,
    })).toThrow();
  });
});

describe('saveDraftSchema', () => {
  it('accepts mixed answer value types', () => {
    expect(() => saveDraftSchema.parse({
      answers: {
        '101': 2,
        '102': 'My essay answer',
        '103': null,
      },
    })).not.toThrow();
  });

  it('rejects more than 1000 answers', () => {
    const answers = Object.fromEntries(
      Array.from({ length: 1001 }, (_, i) => [String(i + 1), 1])
    );
    expect(() => saveDraftSchema.parse({ answers })).toThrow(/Cannot save more than 1000 questions/);
  });
});

describe('submitExamSchema', () => {
  it('accepts registration id with answers', () => {
    expect(() => submitExamSchema.parse({
      registrationId: 14,
      answers: {
        '1': 4,
        '2': 'Final essay answer',
        '3': null,
      },
    })).not.toThrow();
  });

  it('rejects non-supported answer types', () => {
    expect(() => submitExamSchema.parse({
      registrationId: 14,
      answers: {
        '1': true,
      },
    })).toThrow();
  });
});
