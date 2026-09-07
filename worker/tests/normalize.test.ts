import { describe, expect, it } from 'vitest';
import {
  categorizeProject,
  cleanText,
  displayPhone,
  normalizeAccountNumber,
  normalizeBank,
  normalizeEmail,
  normalizeOrg,
  normalizePhone,
  normalizeState,
} from '../src/lib/normalize-org-exports';

describe('cleanText', () => {
  it('trims and collapses whitespace', () => {
    expect(cleanText('  hello   world  ')).toBe('hello world');
  });
  it('handles non-strings', () => {
    expect(cleanText(null)).toBe('');
    expect(cleanText(undefined)).toBe('');
    expect(cleanText(42)).toBe('42');
  });
});

describe('normalizePhone (Nigerian variants from the legacy workbook)', () => {
  it.each([
    ['08039189574', '+2348039189574'],
    ['8039189574', '+2348039189574'], // missing leading 0
    ['O8039189574', '+2348039189574'], // letter O instead of zero
    ['+234 803 918 9574', '+2348039189574'],
    ['0803-918-9574', '+2348039189574'],
    ["'08039189574", '+2348039189574'],
    ['*8039189574', '+2348039189574'],
    ['7072380338', '+2347072380338'],
    ['2349030037916', '+2349030037916'],
    ['', ''],
  ])('normalizes %j → %j', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
  it('displayPhone formats E.164', () => {
    expect(displayPhone('+2348039189574')).toBe('+234 803 918 9574');
  });
});

describe('normalizeState (91 legacy spellings collapse to 37 canonical states)', () => {
  it.each([
    ['ONDO STATE', 'Ondo'],
    ['ONDO', 'Ondo'],
    ['ondo', 'Ondo'],
    ['RIVRES STATE', 'Rivers'],
    ["RIVER'S STATE", 'Rivers'],
    ['RIVER STATE', 'Rivers'],
    ['0YO', 'Oyo'],
    ['Lagod', 'Lagos'],
    ['kWARA', 'Kwara'],
    ['KWARA.', 'Kwara'],
    ['zDelta state', 'Delta'],
    ['ANAMBARA', 'Anambra'],
    ['FCT - ABUJA', 'FCT (Abuja)'],
    ['ABUJA FCT', 'FCT (Abuja)'],
    ['ABUJA', 'FCT (Abuja)'],
    ['IMO STARE', 'Imo'],
    ['IBADAN', 'Oyo'],
    ['ABEOKUTA SOUTH', 'Ogun'],
    ['ENUGU  STATE', 'Enugu'],
    ['NIGER STATE', 'Niger'],
    ['NIGERIA', null], // country name is NOT a state
    ['ROAD CONSTRUCTION & SOLAR LIGHTS', null], // junk in the state column
    ['', null],
  ])('maps %j → %j', (input, expected) => {
    expect(normalizeState(input)).toBe(expected);
  });
});

describe('normalizeBank', () => {
  it.each([
    ['UBA', 'United Bank for Africa (UBA)'],
    ['U B A', 'United Bank for Africa (UBA)'],
    ['U,B,A', 'United Bank for Africa (UBA)'],
    ['UNITED BANK FOR AFRICA (UBA)', 'United Bank for Africa (UBA)'],
    ['GTBANK', 'Guaranty Trust Bank (GTBank)'],
    ['GUARANTY TRUST BANK (GTBANK)', 'Guaranty Trust Bank (GTBank)'],
    ['G T BANK', 'Guaranty Trust Bank (GTBank)'],
    ['FELIDITY BANK', 'Fidelity Bank'],
    ['FIDELLITY', 'Fidelity Bank'],
    ['UNIÓN BANK PLC', 'Union Bank of Nigeria'],
    ['TAJ BANK', 'Taj Bank'],
    ['JAIZ BANK', 'Jaiz Bank'], // TAJ ≠ JAIZ
    ['1027715876', null], // account number typed in bank column
    ['ekechichiwueze@gmail.com', null], // e-mail typed in bank column
    ['', null],
  ])('maps %j → %j', (input, expected) => {
    expect(normalizeBank(input)).toBe(expected);
  });
});

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });
  it('rejects junk', () => {
    expect(normalizeEmail('not-an-email')).toBe('');
    expect(normalizeEmail('a@b')).toBe('');
  });
});

describe('normalizeAccountNumber', () => {
  it('keeps leading zeros, strips punctuation', () => {
    expect(normalizeAccountNumber(',0029337629')).toBe('0029337629');
    expect(normalizeAccountNumber('10 248 22135')).toBe('1024822135');
  });
});

describe('categorizeProject', () => {
  it.each([
    ['ROAD CONSTRUCTION / RURAL ELECTRIFICATION', 'Roads & Infrastructure'],
    ['SCHOOL, HEALTH CENTER, SOLAR LIGHTS, BOREHOLE', 'Education'], // first keyword wins
    ['BOREHOLE SINKING', 'Water & Sanitation'],
    ['SOLAR STREET LIGHTS', 'Energy & Lighting'],
    ["ELECTRICITY'S", 'Energy & Lighting'],
    ['SANDDREDGING/HOSPITAL', 'Health'],
    ['CASSAVA PROCESSING INDUSTRY', 'Agriculture & Food'], // farm-ish keyword "cassava" before "processing"? cassava pos 0 < processing
    ['SHOPPING MALL', 'Commerce & Industry'],
    ['SECURITY POST (POLICE AND CIVIL DEFENCE)', 'Security & Defence'],
    ['ENVIROMENTAL CLEANUP', 'Environment & Cleanup'],
    ['POOL OF DELIVANCE CHRISTIAN MINISTRIES', 'Faith & Social'],
    ['ICT', 'ICT & Technology'],
    ['CCTV CAMERAS AND MONITOR ROOM', 'Security & Defence'],
    ['', 'Other'],
    ['SOMETHING UNRELATED', 'Other'],
  ])('categorizes %j → %j', (input, expected) => {
    expect(categorizeProject(input)).toBe(expected);
  });
});

describe('normalizeOrg (combined)', () => {
  it('applies all rules at once and keeps raw values', () => {
    const n = normalizeOrg({
      sn: '12',
      name: '  TEST   ORG  ',
      state: 'RIVRES STATE',
      bank: 'U B A',
      phone: 'O8039189574',
      email: 'X@Y.CO',
      project_type: 'ROAD AND BOREHOLE',
    });
    expect(n.sn).toBe(12);
    expect(n.name).toBe('TEST ORG');
    expect(n.state).toBe('RIVRES STATE'); // raw kept
    expect(n.state_norm).toBe('Rivers');
    expect(n.bank).toBe('U B A'); // raw kept
    expect(n.bank_norm).toBe('United Bank for Africa (UBA)');
    expect(n.phone).toBe('+2348039189574');
    expect(n.email).toBe('x@y.co');
    expect(n.project_category).toBe('Roads & Infrastructure');
    expect(n.status).toBe('registered');
    expect(n.cycle).toBe('Project 1');
  });
});
