import * as XLSX from 'xlsx';
import type { Bindings } from '../lib/env';
import {
  cleanText,
  normalizeAccountNumber,
  normalizeBank,
  normalizeEmail,
  normalizePhone,
  normalizeState,
} from '../lib/normalize';
import { normalizeOrg, orgInsertSql, type NormalizedOrg } from '../lib/normalize-org';

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

export interface ParsedRowData {
  sn?: number | null;
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
}

export interface ParsedRow {
  excelRow: number; // 1-based row number in the file
  data: ParsedRowData;
  warnings: string[];
  error?: string;
}

export interface ParsedWorkbook {
  headers: string[];
  unmappedHeaders: string[];
  rows: ParsedRow[];
}

type FieldKey = keyof ParsedRowData;

const HEADER_ALIASES: [string, FieldKey][] = [
  ['sn', 'sn'], ['sno', 'sn'], ['sl', 'sn'], ['no', 'sn'], ['serial', 'sn'], ['serialno', 'sn'], ['serialnumber', 'sn'],
  ['name', 'name'], ['nameoforganization', 'name'], ['organization', 'name'], ['organizationname', 'name'],
  ['org', 'name'], ['orgname', 'name'], ['company', 'name'], ['companyname', 'name'], ['nameoforg', 'name'],
  ['nameofceo', 'ceo_name'], ['ceo', 'ceo_name'], ['ceoname', 'ceo_name'],
  ['representative', 'ceo_name'], ['nameofrepresentative', 'ceo_name'],
  ['contactperson', 'ceo_name'], ['contact', 'ceo_name'],
  ['phonenumber', 'phone'], ['phone', 'phone'], ['mobile', 'phone'], ['telephone', 'phone'], ['tel', 'phone'],
  ['bank', 'bank'], ['bankname', 'bank'],
  ['accountnumber', 'account_number'], ['accountno', 'account_number'], ['account', 'account_number'],
  ['acctno', 'account_number'], ['accno', 'account_number'], ['bankaccount', 'account_number'],
  ['email', 'email'], ['emailaddress', 'email'],
  ['localgovernment', 'lga'], ['lga', 'lga'], ['localgovernmentarea', 'lga'], ['localgovt', 'lga'], ['localgvt', 'lga'],
  ['state', 'state'],
  ['projecttype', 'project_type'], ['project', 'project_type'], ['projectdescription', 'project_type'],
  ['typeofproject', 'project_type'], ['projectname', 'project_type'],
  ['status', 'status'],
  ['notes', 'notes'], ['remark', 'notes'], ['remarks', 'notes'], ['comments', 'notes'],
];

function mapHeader(raw: string): FieldKey | null {
  const k = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [alias, field] of HEADER_ALIASES) if (k === alias) return field;
  return null;
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') {
    // Avoid 1e+ notation for large numbers (account numbers typed as numbers).
    return String(v);
  }
  return String(v);
}

/** Validate + normalize one parsed row, collecting soft warnings. */
export function validateRow(row: ParsedRowData): { warnings: string[]; error?: string } {
  const warnings: string[] = [];
  if (!cleanText(row.name)) return { warnings, error: 'Organization name is missing' };
  if (row.phone && !normalizePhone(row.phone)) warnings.push('Phone number could not be normalized');
  if (row.email && !normalizeEmail(row.email)) warnings.push('E-mail address looks invalid');
  if (row.account_number) {
    const d = normalizeAccountNumber(row.account_number);
    if (d.length < 6 || d.length > 12) warnings.push('Account number is not 6–12 digits');
  }
  if (row.bank && !normalizeBank(row.bank)) warnings.push(`Unrecognized bank: “${cleanText(row.bank)}”`);
  if (row.state && !normalizeState(row.state)) warnings.push(`Unrecognized state: “${cleanText(row.state)}”`);
  return { warnings };
}

/**
 * Excel files often carry a sheet range far wider than the actual data
 * (stray formatting out in column XE etc.). SheetJS would then materialize
 * tens of millions of empty cells (20s + >1GB for the legacy workbook).
 * Re-clip the range to the cells that actually exist, with sane caps.
 */
function clipSheetRange(sheet: XLSX.WorkSheet, maxColumns = 100, maxRows = 100_000): void {
  let maxCol = 0;
  let maxRow = 0;
  for (const k of Object.keys(sheet)) {
    if (!k || k[0] === '!') continue;
    const m = /^([A-Z]+)([0-9]+)$/.exec(k);
    if (!m) continue;
    const col = XLSX.utils.decode_col(m[1] as string);
    const row = parseInt(m[2] as string, 10);
    if (col > maxCol) maxCol = col;
    if (row > maxRow) maxRow = row;
  }
  if (maxCol > maxColumns) maxCol = maxColumns;
  if (maxRow > maxRows) maxRow = maxRows;
  if (maxCol > 0 && maxRow > 0) {
    sheet['!ref'] = `A1:${XLSX.utils.encode_col(maxCol - 1)}${maxRow}`;
  }
}

/** Parse an xlsx/xls/csv file into validated rows. */
export async function parseWorkbook(buf: ArrayBuffer, filename: string): Promise<ParsedWorkbook> {
  let rowsOfArrays: unknown[][];
  if (/\.csv$/i.test(filename)) {
    rowsOfArrays = parseCsv(new TextDecoder().decode(buf));
  } else {
    const wb = XLSX.read(buf, { type: 'array' });
    const first = wb.SheetNames[0];
    if (!first) throw new Error('The workbook has no sheets');
    const sheet = wb.Sheets[first];
    if (!sheet) throw new Error('The workbook has no sheets');
    clipSheetRange(sheet);
    rowsOfArrays = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  }

  // Locate the header row: first row with at least two recognized headers.
  let headerIdx = -1;
  let mapping: (FieldKey | null)[] = [];
  for (let i = 0; i < Math.min(rowsOfArrays.length, 25); i++) {
    const row = rowsOfArrays[i] ?? [];
    const map: (FieldKey | null)[] = [];
    let recognized = 0;
    for (let c = 0; c < row.length; c++) {
      const f = mapHeader(cellToString(row[c] ?? ''));
      map[c] = f;
      if (f) recognized++;
    }
    if (recognized >= 2) {
      headerIdx = i;
      mapping = map;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error('Could not find a header row. Expected columns like “NAME OF ORGANIZATION”, “PHONE NUMBER”, “BANK”…');
  }

  const headerNames: string[] = [];
  const unmappedHeaders: string[] = [];
  (rowsOfArrays[headerIdx] ?? []).forEach((h, c) => {
    const name = cleanText(cellToString(h));
    if (!name) return;
    if (mapping[c]) {
      headerNames.push(name);
    } else {
      unmappedHeaders.push(name);
    }
  });

  const rows: ParsedRow[] = [];
  for (let i = headerIdx + 1; i < rowsOfArrays.length; i++) {
    const raw = rowsOfArrays[i] ?? [];
    const data: Record<string, unknown> = {};
    let any = false;
    for (let c = 0; c < raw.length; c++) {
      const f = mapping[c];
      if (!f) continue;
      const s = cellToString(raw[c] ?? '').trim();
      if (!s) continue;
      any = true;
      data[f] = f === 'sn' ? (parseInt(s, 10) || null) : s;
    }
    // Ignore blank rows — including pre-numbered template rows that carry an
    // S/N but nothing else (the legacy workbook has hundreds of these).
    const onlySn = Object.keys(data).length === 1 && (data.sn ?? null) !== null;
    if (!any || onlySn) continue;
    const parsed = data as unknown as ParsedRowData;
    const { warnings, error } = validateRow(parsed);
    rows.push({ excelRow: i + 1, data: parsed, warnings, error });
  }
  return { headers: headerNames, unmappedHeaders, rows };
}

/** Minimal RFC-4180-ish CSV parser (quoted fields, CRLF). */
export function parseCsv(text: string): unknown[][] {
  const rows: unknown[][] = [];
  let row: unknown[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => cellToString(c).trim() !== ''));
}

/* ------------------------------------------------------------------ */
/* Matching + execution                                                */
/* ------------------------------------------------------------------ */

interface IndexRow {
  id: number;
  sn: number | null;
  phone: string | null;
  account_number: string | null;
  dupkey: string;
  state_norm: string | null;
}

export function dupKeyOf(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim().replace(/\s/g, '');
}

export interface ImportPlan {
  uploadId: string;
  filename: string;
  total: number;
  create: number;
  update: number;
  skip: number;
  errors: { excelRow: number; reason: string }[];
  warnings: { excelRow: number; message: string }[];
  headers: string[];
  unmappedHeaders: string[];
  /** One entry per row without a fatal error: normalized values + match id. */
  items: (NormalizedOrg & { excelRow: number; matchId: number | null; warnings: string[] })[];
}

async function buildIndex(env: Bindings): Promise<{ bySn: Map<number, IndexRow>; byDupPhone: Map<string, IndexRow>; byDupAcct: Map<string, IndexRow>; byDup: Map<string, IndexRow[]> }> {
  const rows = (
    await env.DB.prepare(
      `SELECT id, sn, phone, account_number,
        replace(lower(trim(name)), ' ', '') AS dupkey, state_norm
       FROM organizations WHERE deleted_at IS NULL`,
    ).all<IndexRow>()
  ).results;
  const bySn = new Map<number, IndexRow>();
  const byDupPhone = new Map<string, IndexRow>();
  const byDupAcct = new Map<string, IndexRow>();
  const byDup = new Map<string, IndexRow[]>();
  for (const r of rows) {
    if (r.sn != null) bySn.set(r.sn, r);
    if (r.dupkey) {
      const list = byDup.get(r.dupkey) ?? [];
      list.push(r);
      byDup.set(r.dupkey, list);
    }
    if (r.dupkey && r.phone) byDupPhone.set(`${r.dupkey}\u0000${r.phone}`, r);
    if (r.dupkey && r.account_number) byDupAcct.set(`${r.dupkey}\u0000${r.account_number}`, r);
  }
  return { bySn, byDupPhone, byDupAcct, byDup };
}

function matchRow(data: ParsedRowData, index: Awaited<ReturnType<typeof buildIndex>>): number | null {
  const norm = normalizeOrg(data);
  if (norm.sn != null && index.bySn.has(norm.sn)) return index.bySn.get(norm.sn)!.id;
  const key = dupKeyOf(norm.name);
  if (norm.phone) {
    const hit = index.byDupPhone.get(`${key}\u0000${norm.phone}`);
    if (hit) return hit.id;
  }
  if (norm.account_number) {
    const hit = index.byDupAcct.get(`${key}\u0000${norm.account_number}`);
    if (hit) return hit.id;
  }
  if (norm.state_norm) {
    const group = index.byDup.get(key) ?? [];
    const same = group.filter((g) => g.state_norm === norm.state_norm);
    if (same.length === 1) return same[0]!.id;
  }
  return null;
}

export async function planImport(
  env: Bindings,
  buf: ArrayBuffer,
  filename: string,
  strategy: 'update' | 'skip',
): Promise<ImportPlan> {
  const parsed = await parseWorkbook(buf, filename);
  const index = await buildIndex(env);
  const items: ImportPlan['items'] = [];
  const errors: ImportPlan['errors'] = [];
  const warnings: ImportPlan['warnings'] = [];
  let create = 0;
  let update = 0;
  let skip = 0;

  for (const row of parsed.rows) {
    if (row.error) {
      errors.push({ excelRow: row.excelRow, reason: row.error });
      continue;
    }
    const norm = normalizeOrg(row.data);
    const matchId = matchRow(row.data, index);
    const disposition = matchId ? (strategy === 'update' ? 'update' : 'skip') : 'create';
    if (disposition === 'create') create++;
    else if (disposition === 'update') update++;
    else skip++;
    for (const w of row.warnings) warnings.push({ excelRow: row.excelRow, message: w });
    items.push({ ...norm, excelRow: row.excelRow, matchId, warnings: row.warnings });
  }

  const uploadId = crypto.randomUUID();
  // Store the parsed payload + original bytes in R2 for the execute step
  // (lazy-expiring; no cron needed — expired uploads simply 410).
  const payload = {
    uploadId,
    filename,
    strategy,
    uploadedAt: Date.now(),
    headers: parsed.headers,
    unmappedHeaders: parsed.unmappedHeaders,
    errors: errors.slice(0, 200),
    warnings: warnings.slice(0, 200),
    items: items.map((it) => ({ excelRow: it.excelRow, matchId: it.matchId, data: it })),
  };
  await env.FILES.put(`uploads/${uploadId}.json`, new TextEncoder().encode(JSON.stringify(payload)));
  const fileKey = `uploads/${uploadId}.file`;
  await env.FILES.put(fileKey, new Uint8Array(buf));

  return {
    uploadId,
    filename,
    total: parsed.rows.length,
    create,
    update,
    skip,
    errors: errors.slice(0, 200),
    warnings: warnings.slice(0, 200),
    headers: parsed.headers,
    unmappedHeaders: parsed.unmappedHeaders,
    items,
  };
}

const UPLOAD_TTL_MS = 60 * 60 * 1000; // 1 hour — direct (admin) execute path
const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — approval queue

export interface ImportResult {
  importId: number;
  filename: string;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

/** Shared upsert loop: insert unmatched rows, update/skip matched ones. */
async function applyImportItems(
  env: Bindings,
  importId: number,
  items: { matchId: number | null; data: NormalizedOrg }[],
  strategy: 'update' | 'skip',
): Promise<{ created: number; updated: number; skipped: number }> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const insertBatch: string[] = [];
  const updateBatch: D1PreparedStatement[] = [];
  const flush = async () => {
    if (insertBatch.length) {
      const stmts = insertBatch.map((sql) => env.DB.prepare(sql));
      await env.DB.batch(stmts);
      insertBatch.length = 0;
    }
    if (updateBatch.length) {
      await env.DB.batch(updateBatch);
      updateBatch.length = 0;
    }
  };

  for (const item of items) {
    if (item.matchId == null) {
      insertBatch.push(orgInsertSql(item.data, 'import', importId));
      created++;
    } else if (strategy === 'skip') {
      skipped++;
    } else {
      updateBatch.push(
        env.DB.prepare(
          `UPDATE organizations SET
             sn = ?, name = ?, ceo_name = ?, phone = ?, email = ?, bank = ?, bank_norm = ?,
             account_number = ?, lga = ?, state = ?, state_norm = ?, project_type = ?,
             project_category = ?, status = ?, notes = ?, cycle = ?,
             source = 'import', source_import_id = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE id = ?`,
        ).bind(
          item.data.sn, item.data.name, item.data.ceo_name, item.data.phone, item.data.email,
          item.data.bank, item.data.bank_norm, item.data.account_number, item.data.lga,
          item.data.state, item.data.state_norm, item.data.project_type,
          item.data.project_category, item.data.status, item.data.notes, item.data.cycle,
          importId, item.matchId,
        ),
      );
      updated++;
    }
    if (insertBatch.length >= 100 || updateBatch.length >= 100) await flush();
  }
  await flush();
  return { created, updated, skipped };
}

export function isPendingExpired(createdAt: string, now = Date.now()): boolean {
  return now - Date.parse(createdAt) > PENDING_TTL_MS;
}

export async function executeImport(
  env: Bindings,
  uploadId: string,
  strategy: 'update' | 'skip',
  actorEmail: string | null,
): Promise<ImportResult> {
  const obj = await env.FILES.get(`uploads/${uploadId}.json`);
  if (!obj) throw Object.assign(new Error('Upload expired or not found. Please upload the file again.'), { status: 410 });
  const payload = (await obj.json()) as {
    filename: string;
    uploadedAt: number;
    items: { excelRow: number; matchId: number | null; data: NormalizedOrg }[];
  };
  if (Date.now() - payload.uploadedAt > UPLOAD_TTL_MS) {
    throw Object.assign(new Error('Upload expired. Please upload the file again.'), { status: 410 });
  }

  // 1. Create the imports row first so source_import_id can be referenced.
  const ins = await env.DB.prepare(
    `INSERT INTO imports (filename, total_rows, status, actor_email) VALUES (?, 0, 'running', ?)`,
  )
    .bind(payload.filename, actorEmail)
    .run();
  const importId = Number(ins.meta.last_row_id ?? 0);
  const markFailed = async () => {
    try {
      await env.DB.prepare(`UPDATE imports SET status = 'failed' WHERE id = ?`).bind(importId).run();
    } catch {
      /* best effort */
    }
  };

  let created = 0;
  let updated = 0;
  let skipped = 0;

  try {
    ({ created, updated, skipped } = await applyImportItems(env, importId, payload.items, strategy));
  } catch (err) {
    await markFailed();
    throw err;
  }

  // 2. Archive the original file under the import id.
  const fileObj = await env.FILES.get(`uploads/${uploadId}.file`);
  const safeName = payload.filename.replace(/[^\w.\-]+/g, '_').slice(0, 120);
  const r2Key = `imports/${importId}/${safeName}`;
  if (fileObj) {
    const bytes = await fileObj.arrayBuffer();
    await env.FILES.put(r2Key, new Uint8Array(bytes));
  }
  await env.FILES.delete(`uploads/${uploadId}.json`);
  await env.FILES.delete(`uploads/${uploadId}.file`);

  const total = payload.items.length;
  const report = { filename: payload.filename, total, created, updated, skipped, strategy };
  await env.DB.prepare(
    `UPDATE imports SET total_rows = ?, created_count = ?, updated_count = ?, skipped_count = ?,
       error_count = 0, status = 'completed', r2_key = ?, report = ?
     WHERE id = ?`,
  )
    .bind(total, created, updated, skipped, r2Key, JSON.stringify(report), importId)
    .run();

  return { importId, filename: payload.filename, total, created, updated, skipped, errors: 0 };
}

/* ------------------------------------------------------------------ */
/* Approval queue (editor submits → admin approves/rejects)            */
/* ------------------------------------------------------------------ */

function safeFilename(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'upload';
}

interface StoredPayload {
  filename: string;
  strategy: 'update' | 'skip';
  uploadedAt: number;
  headers: string[];
  unmappedHeaders: string[];
  errors: { excelRow: number; reason: string }[];
  warnings: { excelRow: number; message: string }[];
  items: { excelRow: number; matchId: number | null; data: NormalizedOrg }[];
}

/**
 * Convert a finished preview into a pending import. The payload + original
 * file move from the 1-hour `uploads/` area into the permanent
 * `imports/<id>/` area, and a `pending` row is created. No organization data
 * is touched.
 */
export async function submitImport(
  env: Bindings,
  uploadId: string,
  strategy: 'update' | 'skip',
  actorEmail: string | null,
): Promise<{ importId: number; status: 'pending' }> {
  const obj = await env.FILES.get(`uploads/${uploadId}.json`);
  if (!obj) throw Object.assign(new Error('Preview expired. Please upload the file again.'), { status: 410 });
  const payload = (await obj.json()) as StoredPayload;

  const ins = await env.DB.prepare(
    `INSERT INTO imports (filename, status, actor_email, total_rows) VALUES (?, 'pending', ?, ?)`,
  )
    .bind(payload.filename, actorEmail, payload.items.length)
    .run();
  const importId = Number(ins.meta.last_row_id ?? 0);

  const payloadKey = `imports/${importId}/payload.json`;
  const fileKey = `imports/${importId}/${safeFilename(payload.filename)}`;
  await env.FILES.put(payloadKey, new TextEncoder().encode(JSON.stringify(payload)));
  const fileObj = await env.FILES.get(`uploads/${uploadId}.file`);
  if (fileObj) {
    const bytes = await fileObj.arrayBuffer();
    await env.FILES.put(fileKey, new Uint8Array(bytes));
  }
  await env.FILES.delete(`uploads/${uploadId}.json`);
  await env.FILES.delete(`uploads/${uploadId}.file`);

  const total = payload.items.length;
  const create = payload.items.filter((i) => i.matchId == null).length;
  const update = payload.items.filter((i) => i.matchId != null && strategy === 'update').length;
  const skip = payload.items.filter((i) => i.matchId != null && strategy === 'skip').length;
  const report = {
    filename: payload.filename,
    total,
    create,
    update,
    skip,
    strategy,
    errors: payload.errors,
    warnings: payload.warnings,
    unmappedHeaders: payload.unmappedHeaders,
  };
  await env.DB.prepare(
    `UPDATE imports SET payload_key = ?, r2_key = ?, report = ? WHERE id = ?`,
  )
    .bind(payloadKey, fileKey, JSON.stringify(report), importId)
    .run();

  return { importId, status: 'pending' };
}

/**
 * Admin approves a pending import: the parsed rows are re-matched against the
 * current registry (records may have changed since submission), then applied
 * with the strategy chosen at approval time.
 */
export async function approveImport(
  env: Bindings,
  importId: number,
  strategy: 'update' | 'skip',
  reviewerEmail: string | null,
): Promise<ImportResult> {
  const row = await env.DB.prepare('SELECT * FROM imports WHERE id = ?')
    .bind(importId)
    .first<{ id: number; status: string; payload_key: string | null; filename: string; created_at: string }>();
  if (!row) throw Object.assign(new Error('Import not found'), { status: 404 });
  if (row.status === 'completed') throw Object.assign(new Error('This import was already applied.'), { status: 409 });
  if (row.status === 'rejected') throw Object.assign(new Error('This import was rejected.'), { status: 409 });
  if (row.status !== 'pending') throw Object.assign(new Error('Import is not awaiting review.'), { status: 409 });
  if (!row.payload_key) throw Object.assign(new Error('Import payload is missing.'), { status: 410 });
  if (isPendingExpired(row.created_at)) {
    await env.DB.prepare(
      `UPDATE imports SET status = 'rejected', rejection_reason = 'Expired — not reviewed within 7 days',
         reviewed_by = ?, reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    ).bind(reviewerEmail, importId).run();
    throw Object.assign(new Error('This submission expired (not reviewed within 7 days). Please upload again.'), { status: 410 });
  }

  const obj = await env.FILES.get(row.payload_key);
  if (!obj) throw Object.assign(new Error('Import payload is missing.'), { status: 410 });
  const payload = (await obj.json()) as StoredPayload;

  // Re-match against the CURRENT registry: rows may have been added, edited
  // or (soft) deleted between submission and approval. Normalized values are
  // idempotent under normalizeOrg, so normalized items can be re-matched.
  const index = await buildIndex(env);
  const items = payload.items.map((it) => ({
    matchId: matchRow(it.data as unknown as ParsedRowData, index),
    data: it.data,
  }));

  const markFailed = async () => {
    try {
      await env.DB.prepare(`UPDATE imports SET status = 'failed' WHERE id = ?`).bind(importId).run();
    } catch {
      /* best effort */
    }
  };

  let created = 0;
  let updated = 0;
  let skipped = 0;
  try {
    ({ created, updated, skipped } = await applyImportItems(env, importId, items, strategy));
  } catch (err) {
    await markFailed();
    throw err;
  }

  const total = payload.items.length;
  const report = {
    ...(payload.errors || payload.warnings || payload.unmappedHeaders
      ? { errors: payload.errors, warnings: payload.warnings, unmappedHeaders: payload.unmappedHeaders }
      : {}),
    filename: payload.filename,
    total,
    created,
    updated,
    skipped,
    strategy,
    approvedBy: reviewerEmail,
  };
  await env.DB.prepare(
    `UPDATE imports SET total_rows = ?, created_count = ?, updated_count = ?, skipped_count = ?,
       error_count = 0, status = 'completed', reviewed_by = ?, reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       report = ?
     WHERE id = ?`,
  )
    .bind(total, created, updated, skipped, reviewerEmail, JSON.stringify(report), importId)
    .run();
  await env.FILES.delete(row.payload_key);

  return { importId, filename: payload.filename, total, created, updated, skipped, errors: 0 };
}

export async function rejectImport(
  env: Bindings,
  importId: number,
  reason: string | null,
  reviewerEmail: string | null,
): Promise<{ importId: number; status: 'rejected' }> {
  const row = await env.DB.prepare('SELECT id, status FROM imports WHERE id = ?')
    .bind(importId)
    .first<{ id: number; status: string }>();
  if (!row) throw Object.assign(new Error('Import not found'), { status: 404 });
  if (row.status !== 'pending') throw Object.assign(new Error('Only pending imports can be rejected.'), { status: 409 });
  await env.DB.prepare(
    `UPDATE imports SET status = 'rejected', rejection_reason = ?, reviewed_by = ?,
       reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
  )
    .bind(reason, reviewerEmail, importId)
    .run();
  const payloadKey = await env.DB.prepare('SELECT payload_key FROM imports WHERE id = ?')
    .bind(importId)
    .first<{ payload_key: string | null }>();
  if (payloadKey?.payload_key) await env.FILES.delete(payloadKey.payload_key).catch(() => {});
  return { importId, status: 'rejected' };
}
