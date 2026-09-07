import { describe, expect, it } from 'vitest';
import { fillTrendDays, makeReference } from '../src/lib/public';
import { popFileExt, publicSubmissionSchema } from '../src/lib/validate';

const YEAR = new Date().getUTCFullYear();

describe('makeReference', () => {
  it('pads the id to five digits with the current UTC year', () => {
    expect(makeReference(1)).toBe(`SAM-${YEAR}-00001`);
    expect(makeReference(42)).toBe(`SAM-${YEAR}-00042`);
    expect(makeReference(12345)).toBe(`SAM-${YEAR}-12345`);
  });

  it('uses the year of the given date', () => {
    expect(makeReference(7, new Date('2027-01-01T00:00:00Z'))).toBe('SAM-2027-00007');
  });
});

describe('popFileExt', () => {
  it('accepts image extensions from the file name', () => {
    expect(popFileExt('pop.JPG', null)).toBe('jpg');
    expect(popFileExt('receipt.jpeg', null)).toBe('jpg');
    expect(popFileExt('screenshot.PNG', null)).toBe('png');
    expect(popFileExt('pop.webp', null)).toBe('webp');
  });

  it('falls back to the MIME type', () => {
    expect(popFileExt('noext', 'image/png')).toBe('png');
    expect(popFileExt('weird_name', 'image/jpeg')).toBe('jpg');
  });

  it('rejects non-image files', () => {
    expect(popFileExt('malware.exe', 'application/octet-stream')).toBeNull();
    expect(popFileExt('doc.pdf', 'application/pdf')).toBeNull();
    expect(popFileExt(undefined, null)).toBeNull();
    expect(popFileExt('image.gif', 'image/gif')).toBeNull();
  });
});

describe('publicSubmissionSchema', () => {
  const valid = {
    org_name: 'Emokpae Community Association',
    phone: '0803 123 4567',
    state: 'Edo',
    bank: 'Zenith Bank',
    account_number: '1012345678',
    account_name: 'Imuetinyan Emokpae',
    amount_paid: '1000',
    payment_date: '2026-09-07',
    payment_reference: 'T-88992',
    notes: 'Thank you',
  };

  it('accepts a complete submission and coerces the amount', () => {
    const r = publicSubmissionSchema.parse(valid);
    expect(r.amount_paid).toBe(1000);
    expect(r.state).toBe('Edo');
    expect(r.org_name).toBe('Emokpae Community Association');
  });

  it('allows optional fields to be omitted / blank', () => {
    const r = publicSubmissionSchema.parse({
      org_name: 'Small Cof',
      phone: '08031234567',
      bank: 'GTBank',
      account_number: '0012345678',
      amount_paid: 1500,
    });
    expect(r.state).toBeNull();
    expect(r.account_name).toBeNull();
    expect(r.payment_date).toBeNull();
    expect(r.notes).toBeNull();
  });

  it('requires a valid phone', () => {
    expect(() => publicSubmissionSchema.parse({ ...valid, phone: '123' })).toThrow();
    expect(() => publicSubmissionSchema.parse({ ...valid, phone: '' })).toThrow();
  });

  it('requires an 8–12 digit account number', () => {
    expect(() => publicSubmissionSchema.parse({ ...valid, account_number: '12345' })).toThrow();
    expect(() =>
      publicSubmissionSchema.parse({ ...valid, account_number: '1234567890123' }),
    ).toThrow();
    expect(publicSubmissionSchema.parse({ ...valid, account_number: '0012345678' }).account_number).toBe(
      '0012345678',
    );
  });

  it('bounds the amount in Naira', () => {
    expect(() => publicSubmissionSchema.parse({ ...valid, amount_paid: 99 })).toThrow();
    expect(publicSubmissionSchema.parse({ ...valid, amount_paid: 100 }).amount_paid).toBe(100);
    expect(publicSubmissionSchema.parse({ ...valid, amount_paid: 100000 }).amount_paid).toBe(100000);
    expect(() => publicSubmissionSchema.parse({ ...valid, amount_paid: 100001 })).toThrow();
    expect(() => publicSubmissionSchema.parse({ ...valid, amount_paid: 'abc' })).toThrow();
  });

  it('validates the payment date format', () => {
    expect(() => publicSubmissionSchema.parse({ ...valid, payment_date: '07/09/2026' })).toThrow();
    expect(publicSubmissionSchema.parse({ ...valid, payment_date: '2026-09-07' }).payment_date).toBe('2026-09-07');
  });

  it('caps the organization name length', () => {
    expect(() => publicSubmissionSchema.parse({ ...valid, org_name: 'x'.repeat(201) })).toThrow();
  });
});

describe('fillTrendDays', () => {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  it('fills 14 days ending today', () => {
    const out = fillTrendDays([], 14);
    expect(out).toHaveLength(14);
    expect(out[13]?.date).toBe(today);
    expect(out.every((d) => d.total === 0)).toBe(true);
  });

  it('places rows on their dates and derives pending', () => {
    const out = fillTrendDays(
      [
        { date: today, total: 5, verified: 2, rejected: 1 },
        { date: yesterday, total: 3, verified: null, rejected: null },
      ],
      14,
    );
    const t = out.find((d) => d.date === today)!;
    expect(t).toEqual({ date: today, total: 5, verified: 2, rejected: 1, pending: 2 });
    const y = out.find((d) => d.date === yesterday)!;
    expect(y).toEqual({ date: yesterday, total: 3, verified: 0, rejected: 0, pending: 3 });
  });

  it('ignores rows outside the window', () => {
    const out = fillTrendDays([{ date: '2020-01-01', total: 9, verified: 9, rejected: 0 }], 14);
    expect(out.reduce((s, d) => s + d.total, 0)).toBe(0);
  });
});
