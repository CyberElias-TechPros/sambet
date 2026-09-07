import { describe, expect, it } from 'vitest';
import { generateTempPassword } from '../src/routes/users';
import { isPendingExpired } from '../src/services/importer';

function classCount(s: string): number {
  return [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(s)).length;
}

describe('generateTempPassword', () => {
  it('is always 16 chars and satisfies the strength policy', () => {
    for (let i = 0; i < 200; i++) {
      const p = generateTempPassword();
      expect(p).toHaveLength(16);
      expect(classCount(p)).toBeGreaterThanOrEqual(3);
      expect(/[a-z]/.test(p)).toBe(true);
      expect(/[A-Z]/.test(p)).toBe(true);
      expect(/\d/.test(p)).toBe(true);
      expect(/[^A-Za-z0-9]/.test(p)).toBe(true);
    }
  });

  it('generates distinct passwords', () => {
    const set = new Set(Array.from({ length: 50 }, () => generateTempPassword()));
    expect(set.size).toBe(50);
  });
});

describe('isPendingExpired', () => {
  const now = Date.parse('2026-09-07T00:00:00.000Z');
  it('is false within the 7-day review window', () => {
    expect(isPendingExpired(new Date(now - 6 * 24 * 3600_000).toISOString(), now)).toBe(false);
  });
  it('is true after 7 days', () => {
    expect(isPendingExpired(new Date(now - 8 * 24 * 3600_000).toISOString(), now)).toBe(true);
  });
  it('boundary: exactly 7 days is not expired', () => {
    expect(isPendingExpired(new Date(now - 7 * 24 * 3600_000).toISOString(), now)).toBe(false);
  });
});
