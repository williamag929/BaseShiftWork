import { loginSchema, registerStep1Schema, registerStep2Schema } from '../schemas/auth';
import { timeOffSchema } from '../schemas/timeoff';

describe('loginSchema', () => {
  it('parses valid credentials', () => {
    expect(() =>
      loginSchema.parse({ email: 'user@example.com', password: 'secret' }),
    ).not.toThrow();
  });

  it('rejects invalid email format', () => {
    const res = loginSchema.safeParse({ email: 'notanemail', password: 'secret' });
    expect(res.success).toBe(false);
  });

  it('rejects empty password', () => {
    const res = loginSchema.safeParse({ email: 'user@example.com', password: '' });
    expect(res.success).toBe(false);
  });
});

describe('registerStep1Schema', () => {
  it('parses valid registration data', () => {
    expect(() =>
      registerStep1Schema.parse({
        displayName: 'Alice',
        email: 'alice@example.com',
        password: 'Password1!',
      }),
    ).not.toThrow();
  });

  it('rejects password shorter than 8 characters', () => {
    const res = registerStep1Schema.safeParse({
      displayName: 'Alice',
      email: 'alice@example.com',
      password: 'pass',
    });
    expect(res.success).toBe(false);
  });

  it('rejects empty display name', () => {
    const res = registerStep1Schema.safeParse({
      displayName: '',
      email: 'alice@example.com',
      password: 'Password1!',
    });
    expect(res.success).toBe(false);
  });
});

describe('registerStep2Schema', () => {
  it('parses valid company data', () => {
    expect(() =>
      registerStep2Schema.parse({
        companyName: 'Acme Corp',
        companyEmail: 'info@acme.com',
        timeZone: 'America/New_York',
      }),
    ).not.toThrow();
  });

  it('rejects invalid company email', () => {
    const res = registerStep2Schema.safeParse({
      companyName: 'Acme Corp',
      companyEmail: 'not-an-email',
    });
    expect(res.success).toBe(false);
  });
});

describe('timeOffSchema', () => {
  const tomorrow = new Date(Date.now() + 86_400_000);
  const dayAfter = new Date(Date.now() + 172_800_000);

  it('parses a valid time-off request', () => {
    expect(() =>
      timeOffSchema.parse({ type: 'Vacation', startDate: tomorrow, endDate: dayAfter }),
    ).not.toThrow();
  });

  it('rejects end date before start date', () => {
    const res = timeOffSchema.safeParse({
      type: 'Vacation',
      startDate: dayAfter,
      endDate: tomorrow,
    });
    expect(res.success).toBe(false);
  });

  it('rejects an invalid type enum value', () => {
    const res = timeOffSchema.safeParse({
      type: 'Sabbatical',
      startDate: tomorrow,
      endDate: dayAfter,
    });
    expect(res.success).toBe(false);
  });
});
