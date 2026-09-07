import { describe, expect, it } from 'vitest';
import { loginSchema, orgInputSchema, setupSchema, zodFieldErrors } from '../src/lib/validate';

describe('orgInputSchema', () => {
  it('accepts a minimal org (name only)', () => {
    const r = orgInputSchema.safeParse({ name: 'ACME' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe('ACME');
      expect(r.data.status).toBe('registered');
      expect(r.data.cycle).toBe('Project 1');
    }
  });

  it('rejects empty name with a field error', () => {
    const r = orgInputSchema.safeParse({ name: '   ' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const fields = zodFieldErrors(r);
      expect(fields.name).toBeTruthy();
    }
  });

  it('rejects bad phone and account numbers', () => {
    expect(orgInputSchema.safeParse({ name: 'A', phone: 'abc' }).success).toBe(false);
    expect(orgInputSchema.safeParse({ name: 'A', account_number: '123' }).success).toBe(false);
    expect(orgInputSchema.safeParse({ name: 'A', account_number: '1234567890' }).success).toBe(true);
  });

  it('rejects bad status enum', () => {
    expect(orgInputSchema.safeParse({ name: 'A', status: 'banana' }).success).toBe(false);
  });

  it('coerces sn from numeric string', () => {
    const r = orgInputSchema.safeParse({ name: 'A', sn: '42' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.sn).toBe(42);
  });
});

describe('loginSchema / setupSchema', () => {
  it('requires letter + number in passwords for setup', () => {
    expect(setupSchema.safeParse({ name: 'A B', email: 'a@b.co', password: 'abcdefgh' }).success).toBe(false);
    expect(setupSchema.safeParse({ name: 'A B', email: 'a@b.co', password: 'abc12345' }).success).toBe(true);
  });
  it('login requires valid e-mail', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: 'abc12345' }).success).toBe(false);
  });
});
