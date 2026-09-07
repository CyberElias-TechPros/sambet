import { describe, expect, it } from 'vitest';
import { dupKeyOf, parseCsv, parseWorkbook, validateRow } from '../src/services/importer';

describe('parseCsv', () => {
  it('parses quoted fields with commas and escaped quotes', () => {
    const rows = parseCsv('a,b,c\n"hello, world","say ""hi""",3\n4,5,6\n');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['hello, world', 'say "hi"', '3'],
      ['4', '5', '6'],
    ]);
  });
  it('handles CRLF and trailing blank lines', () => {
    const rows = parseCsv('a,b\r\n1,2\r\n\r\n');
    expect(rows).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('parseWorkbook header mapping', () => {
  it('maps the legacy workbook headers and skips S/N-only rows', async () => {
    const csv = [
      'S/N,NAME OF ORGANIZATION,NAME OF CEO,PHONE NUMBER,BANK,ACCOUNT NUMBER,EMAIL,LOCAL GOVERNMENT,STATE,PROJECT TYPE',
      '1,ACME COOP,JOHN DOE,08031234567,UBA,1012345678,john@acme.ng,MUSHIN,Lagos,ROAD',
      '2,,,,,,,,,,', // blank
      '3', // S/N only (pre-numbered template row)
    ].join('\n');
    const buf = new TextEncoder().encode(csv).buffer as ArrayBuffer;
    const parsed = await parseWorkbook(buf, 'test.csv');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]!.data.name).toBe('ACME COOP');
    expect(parsed.rows[0]!.data.state).toBe('Lagos');
    expect(parsed.rows[0]!.error).toBeUndefined();
  });

  it('finds the header row even after a title row', async () => {
    const csv = ['UAAG VIP MEMBERS', '', 'S/N, NAME OF ORGANIZATION, PHONE NUMBER', '1, ACME, 08031112222'].join('\n');
    const buf = new TextEncoder().encode(csv).buffer as ArrayBuffer;
    const parsed = await parseWorkbook(buf, 'test.csv');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]!.data.name).toBe('ACME');
  });

  it('reports rows with no name as errors', async () => {
    const csv = ['NAME OF ORGANIZATION,PHONE NUMBER', ',08031112222', 'ACME,08031112223'].join('\n');
    const buf = new TextEncoder().encode(csv).buffer as ArrayBuffer;
    const parsed = await parseWorkbook(buf, 'test.csv');
    expect(parsed.rows[0]!.error).toBe('Organization name is missing');
    expect(parsed.rows[1]!.error).toBeUndefined();
  });

  it('rejects files without a recognizable header', async () => {
    const csv = 'foo,bar\n1,2\n';
    const buf = new TextEncoder().encode(csv).buffer as ArrayBuffer;
    await expect(parseWorkbook(buf, 'test.csv')).rejects.toThrow(/header row/i);
  });
});

describe('validateRow warnings', () => {
  it('flags invalid bank/state/phone/email without failing the row', () => {
    const { warnings, error } = validateRow({
      name: 'ACME',
      bank: '12345678',
      state: 'NARNIA',
      email: 'nope',
      phone: 'x',
      account_number: '12',
    });
    expect(error).toBeUndefined();
    expect(warnings).toContain('Unrecognized bank: “12345678”');
    expect(warnings).toContain('Unrecognized state: “NARNIA”');
    expect(warnings).toContain('E-mail address looks invalid');
    expect(warnings).toContain('Account number is not 6–12 digits');
  });
});

describe('dupKeyOf', () => {
  it('is case/space insensitive', () => {
    expect(dupKeyOf('  St   Mary  ')).toBe(dupKeyOf('st mary'));
  });
});
