import * as XLSX from 'xlsx';
import type { Bindings } from '../lib/env';
import { displayPhone } from '../lib/normalize';
import type { OrgFilters, OrgRow } from './organizations';

const EXPORT_CAP = 20_000;

const COLUMNS: { header: string; get: (o: OrgRow) => string | number | null }[] = [
  { header: 'S/N', get: (o) => o.sn },
  { header: 'Name of Organization', get: (o) => o.name },
  { header: 'Name of CEO', get: (o) => o.ceo_name },
  { header: 'Phone Number', get: (o) => (o.phone ? displayPhone(o.phone) : null) },
  { header: 'Email', get: (o) => o.email },
  { header: 'Bank', get: (o) => o.bank },
  { header: 'Bank (standardized)', get: (o) => o.bank_norm },
  { header: 'Account Number', get: (o) => o.account_number },
  { header: 'Local Government', get: (o) => o.lga },
  { header: 'State', get: (o) => o.state },
  { header: 'State (standardized)', get: (o) => o.state_norm },
  { header: 'Project Type', get: (o) => o.project_type },
  { header: 'Project Category', get: (o) => o.project_category },
  { header: 'Status', get: (o) => o.status },
  { header: 'Cycle', get: (o) => o.cycle },
  { header: 'Notes', get: (o) => o.notes },
  { header: 'Source', get: (o) => o.source },
  { header: 'Imported', get: (o) => o.source_import_id ? 'yes' : 'no' },
  { header: 'Created', get: (o) => o.created_at },
  { header: 'Updated', get: (o) => o.updated_at },
];

async function exportRows(env: Bindings, f: OrgFilters): Promise<OrgRow[]> {
  const { sql, params } = buildWhereExport(f);
  const rows = (
    await env.DB.prepare(
      `SELECT * FROM organizations WHERE ${sql} ORDER BY COALESCE(sn, 999999999) ASC, id ASC LIMIT ${EXPORT_CAP}`,
    )
      .bind(...params)
      .all<OrgRow>()
  ).results;
  return rows;
}

// Mirrors the list filters (no pagination/sort — export is always S/N order).
function buildWhereExport(f: OrgFilters): { sql: string; params: unknown[] } {
  const where: string[] = ['deleted_at IS NULL'];
  const params: unknown[] = [];
  if (f.search) {
    const s = `%${f.search.trim()}%`;
    where.push(
      `(lower(name) LIKE lower(?) OR lower(COALESCE(ceo_name,'')) LIKE lower(?)
        OR lower(COALESCE(phone,'')) LIKE lower(?) OR lower(COALESCE(email,'')) LIKE lower(?)
        OR lower(COALESCE(lga,'')) LIKE lower(?) OR lower(COALESCE(account_number,'')) LIKE lower(?))`,
    );
    params.push(s, s, s, s, s, s);
  }
  if (f.state) { where.push('state_norm = ?'); params.push(f.state); }
  if (f.category) { where.push('project_category = ?'); params.push(f.category); }
  if (f.bank) { where.push('bank_norm = ?'); params.push(f.bank); }
  if (f.status) { where.push('status = ?'); params.push(f.status); }
  if (f.cycle) { where.push('cycle = ?'); params.push(f.cycle); }
  if (f.incomplete) {
    where.push(
      `(ceo_name IS NULL OR ceo_name = '') + (phone IS NULL OR phone = '') + (email IS NULL OR email = '')
       + (state_norm IS NULL OR state_norm = '') + (lga IS NULL OR lga = '') + (bank IS NULL OR bank = '')
       + (account_number IS NULL OR account_number = '') + (project_type IS NULL OR project_type = '') > 0`,
    );
  }
  if (f.duplicate) {
    where.push(
      `EXISTS (SELECT 1 FROM organizations x WHERE x.deleted_at IS NULL AND x.id != organizations.id
        AND replace(lower(trim(x.name)), ' ', '') = replace(lower(trim(organizations.name)), ' ', '')
        AND COALESCE(x.state_norm, '') = COALESCE(organizations.state_norm, ''))`,
    );
  }
  return { sql: where.join(' AND '), params };
}

function filenameFor(format: 'xlsx' | 'csv'): string {
  const d = new Date().toISOString().slice(0, 10);
  return `sambet-organizations-${d}.${format}`;
}

export async function exportOrgs(
  env: Bindings,
  f: OrgFilters,
  format: 'xlsx' | 'csv',
): Promise<{ body: ArrayBuffer | Uint8Array; filename: string; contentType: string }> {
  const rows = await exportRows(env, f);
  const filename = filenameFor(format);
  if (format === 'csv') {
    const lines: string[] = [COLUMNS.map((c) => csvEsc(c.header)).join(',')];
    for (const r of rows) {
      lines.push(COLUMNS.map((c) => csvEsc(String(c.get(r) ?? ''))).join(','));
    }
    return { body: new TextEncoder().encode(lines.join('\r\n') + '\r\n'), filename, contentType: 'text/csv; charset=utf-8' };
  }
  const aoa: (string | number | null)[][] = [COLUMNS.map((c) => c.header)];
  for (const r of rows) aoa.push(COLUMNS.map((c) => c.get(r)));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Sensible column widths.
  ws['!cols'] = COLUMNS.map((c, i) => ({
    wch: Math.min(45, Math.max(10, c.header.length, ...(i === 1 ? rows.slice(0, 50).map((r) => r.name.length) : []))),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Organizations');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return { body: out, filename, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
}

function csvEsc(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Small template file for the import screen. */
export function importTemplateXlsx(): { body: ArrayBuffer; filename: string } {
  const header = ['S/N', 'NAME OF ORGANIZATION', 'NAME OF CEO', 'PHONE NUMBER', 'BANK', 'ACCOUNT NUMBER', 'EMAIL', 'LOCAL GOVERNMENT', 'STATE', 'PROJECT TYPE'];
  const aoa: (string | number | null)[][] = [
    header,
    [1, 'EXAMPLE MULTIPURPOSE COOPERATIVE LTD', 'ADEBAYO JOHN', '08031234567', 'ZENITH BANK', '1012345678', 'example@gmail.com', 'MUSHIN', 'Lagos', 'ROAD CONSTRUCTION AND BOREHOLES'],
    [2, 'SAMPLE ENTERPRISE', 'CHINEDU OKAFOR', '08037654321', 'UBA', '2123456789', '', 'OGBARU', 'Anambra', 'SOLAR STREET LIGHTS'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = header.map((h) => ({ wch: Math.max(12, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Organizations');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return { body: out, filename: 'sambet-import-template.xlsx' };
}
