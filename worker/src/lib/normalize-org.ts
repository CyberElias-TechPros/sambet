import { sqlLiteral } from '../db';
import {
  categorizeProject,
  cleanText,
  normalizeAccountNumber,
  normalizeBank,
  normalizeEmail,
  normalizePhone,
  normalizeState,
} from './normalize';

export interface NormalizedOrg {
  sn: number | null;
  name: string;
  ceo_name: string | null;
  phone: string | null;
  email: string | null;
  bank: string | null;
  bank_norm: string | null;
  account_number: string | null;
  lga: string | null;
  state: string | null;
  state_norm: string | null;
  project_type: string | null;
  project_category: string;
  status: string;
  notes: string | null;
  cycle: string;
}

/**
 * Apply all normalization rules to validated input. Pure — no I/O — so the
 * same code path runs for manual entry, Excel import and the seed generator.
 */
export function normalizeOrg(input: {
  sn?: number | string | null;
  name: string;
  ceo_name?: string | null;
  phone?: string | null;
  email?: string | null;
  bank?: string | null;
  account_number?: string | null;
  lga?: string | null;
  state?: string | null;
  project_type?: string | null;
  status?: string | null;
  notes?: string | null;
  cycle?: string | null;
}): NormalizedOrg {
  const name = cleanText(input.name);
  const projectType = cleanText(input.project_type ?? '');
  const stateRaw = cleanText(input.state ?? '');
  const bankRaw = cleanText(input.bank ?? '');

  return {
    sn: typeof input.sn === 'number' ? input.sn : input.sn ? parseInt(String(input.sn), 10) || null : null,
    name,
    ceo_name: cleanText(input.ceo_name ?? '') || null,
    phone: normalizePhone(input.phone ?? '') || null,
    email: normalizeEmail(input.email ?? '') || null,
    bank: bankRaw || null,
    bank_norm: normalizeBank(bankRaw),
    account_number: normalizeAccountNumber(input.account_number ?? '') || null,
    lga: cleanText(input.lga ?? '') || null,
    state: stateRaw || null,
    state_norm: normalizeState(stateRaw),
    project_type: projectType || null,
    project_category: categorizeProject(projectType),
    status: input.status || 'registered',
    notes: cleanText(input.notes ?? '') || null,
    cycle: cleanText(input.cycle ?? '') || 'Project 1',
  };
}

/**
 * Column list + VALUES tuple for INSERTs into organizations.
 * created_at / updated_at / deleted_at use the schema defaults.
 */
export function orgInsertSql(o: NormalizedOrg, source: string, sourceImportId: number | null): string {
  const cols = [
    'sn', 'name', 'ceo_name', 'phone', 'email', 'bank', 'bank_norm', 'account_number',
    'lga', 'state', 'state_norm', 'project_type', 'project_category', 'status', 'notes',
    'cycle', 'source', 'source_import_id',
  ];
  const values = [
    sqlLiteral(o.sn),
    sqlLiteral(o.name),
    sqlLiteral(o.ceo_name),
    sqlLiteral(o.phone),
    sqlLiteral(o.email),
    sqlLiteral(o.bank),
    sqlLiteral(o.bank_norm),
    sqlLiteral(o.account_number),
    sqlLiteral(o.lga),
    sqlLiteral(o.state),
    sqlLiteral(o.state_norm),
    sqlLiteral(o.project_type),
    sqlLiteral(o.project_category),
    sqlLiteral(o.status),
    sqlLiteral(o.notes),
    sqlLiteral(o.cycle),
    sqlLiteral(source),
    sqlLiteral(sourceImportId),
  ];
  return `INSERT INTO organizations (${cols.join(', ')}) VALUES (${values.join(', ')})`;
}
