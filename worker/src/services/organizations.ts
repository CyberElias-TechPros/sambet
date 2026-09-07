import type { Bindings } from '../lib/env';
import { normalizeOrg, type NormalizedOrg } from '../lib/normalize-org';
import type { OrgInput } from '../lib/validate';

export interface OrgRow {
  id: number;
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
  source: string;
  source_import_id: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_duplicate: number;
  missing_count: number;
}

export interface OrgFilters {
  search?: string;
  state?: string; // canonical
  category?: string;
  bank?: string; // canonical
  status?: string;
  cycle?: string;
  incomplete?: boolean;
  duplicate?: boolean;
  sort?: 'updated_at' | 'name' | 'sn' | 'created_at';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

const SORT_COLUMNS: Record<NonNullable<OrgFilters['sort']>, string> = {
  updated_at: 'updated_at',
  name: 'name',
  sn: 'COALESCE(sn, 0)',
  created_at: 'created_at',
};

function buildWhere(f: OrgFilters): { sql: string; params: unknown[] } {
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
  if (f.state) {
    where.push('state_norm = ?');
    params.push(f.state);
  }
  if (f.category) {
    where.push('project_category = ?');
    params.push(f.category);
  }
  if (f.bank) {
    where.push('bank_norm = ?');
    params.push(f.bank);
  }
  if (f.status) {
    where.push('status = ?');
    params.push(f.status);
  }
  if (f.cycle) {
    where.push('cycle = ?');
    params.push(f.cycle);
  }
  if (f.incomplete) {
    // (computed missing_count is a SELECT alias — can't be used in WHERE)
    where.push(
      `((ceo_name IS NULL OR ceo_name = '') + (phone IS NULL OR phone = '')
        + (email IS NULL OR email = '') + (state_norm IS NULL)
        + (lga IS NULL OR lga = '') + (bank IS NULL OR bank = '')
        + (account_number IS NULL OR account_number = '')
        + (project_type IS NULL OR project_type = '')) > 0`,
    );
  }
  if (f.duplicate) {
    where.push(
      `EXISTS (SELECT 1 FROM organizations x
        WHERE x.deleted_at IS NULL AND x.id != o.id
          AND replace(lower(trim(x.name)), ' ', '') = replace(lower(trim(o.name)), ' ', '')
          AND COALESCE(x.state_norm, '') = COALESCE(o.state_norm, ''))`,
    );
  }
  return { sql: where.join(' AND '), params };
}

const BASE_SELECT = `
  SELECT o.*,
    (SELECT COUNT(*) FROM organizations x
      WHERE x.deleted_at IS NULL
        AND replace(lower(trim(x.name)), ' ', '') = replace(lower(trim(o.name)), ' ', '')
        AND COALESCE(x.state_norm,'') = COALESCE(o.state_norm,'')
    ) > 0 AS is_duplicate,
    (
      (o.name IS NULL OR o.name = '')
      + (o.ceo_name IS NULL OR o.ceo_name = '')
      + (o.phone IS NULL OR o.phone = '')
      + (o.email IS NULL OR o.email = '')
      + (o.state_norm IS NULL OR o.state_norm = '')
      + (o.lga IS NULL OR o.lga = '')
      + (o.bank IS NULL OR o.bank = '')
      + (o.account_number IS NULL OR o.account_number = '')
      + (o.project_type IS NULL OR o.project_type = '')
    ) AS missing_count
  FROM organizations o
`;

export async function listOrgs(env: Bindings, f: OrgFilters): Promise<{ data: OrgRow[]; total: number }> {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 25));
  const sort = f.sort && SORT_COLUMNS[f.sort] ? f.sort : 'updated_at';
  const order = f.order === 'asc' ? 'ASC' : 'DESC';
  const { sql, params } = buildWhere(f);
  const sortSql = SORT_COLUMNS[sort] ?? SORT_COLUMNS.updated_at;

  const totalRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM organizations o WHERE ${sql}`,
  ).bind(...params).first<{ n: number }>();
  const total = totalRow?.n ?? 0;

  // Stable secondary sort keeps pagination deterministic.
  const secondary = sort === 'name' ? 'sn DESC, ' : sort === 'sn' ? 'name ASC, ' : 'id DESC, ';
  const data = (
    await env.DB.prepare(
      `${BASE_SELECT} WHERE ${sql} ORDER BY ${sortSql} ${order}, ${secondary}id DESC LIMIT ? OFFSET ?`,
    )
      .bind(...params, pageSize, (page - 1) * pageSize)
      .all<OrgRow>()
  ).results;
  return { data, total };
}

export async function getOrg(env: Bindings, id: number): Promise<OrgRow | null> {
  const row = await env.DB.prepare(`${BASE_SELECT} WHERE o.id = ? AND o.deleted_at IS NULL`)
    .bind(id)
    .first<OrgRow>();
  return row ?? null;
}

/** Names of fields missing on this org (drives the "needs attention" UI). */
export function missingFields(o: {
  ceo_name: string | null; phone: string | null; email: string | null;
  state_norm: string | null; lga: string | null; bank: string | null;
  account_number: string | null; project_type: string | null;
}): string[] {
  const out: string[] = [];
  if (!o.ceo_name) out.push('Contact person');
  if (!o.phone) out.push('Phone');
  if (!o.email) out.push('E-mail');
  if (!o.state_norm) out.push('State');
  if (!o.lga) out.push('Local government');
  if (!o.bank) out.push('Bank');
  if (!o.account_number) out.push('Account number');
  if (!o.project_type) out.push('Project type');
  return out;
}

/** Organizations sharing the same normalized name + state. */
export async function findDuplicates(env: Bindings, o: OrgRow, limit = 8): Promise<OrgRow[]> {
  const rows = (
    await env.DB.prepare(
      `SELECT o.*,
         1 AS is_duplicate,
         0 AS missing_count
       FROM organizations o
       WHERE o.deleted_at IS NULL AND o.id != ?
         AND replace(lower(trim(o.name)), ' ', '') = replace(lower(trim(?)), ' ', '')
         AND COALESCE(o.state_norm,'') = COALESCE(?, '')
       ORDER BY o.id LIMIT ?`,
    )
      .bind(o.id, o.name, o.state_norm ?? '', limit)
      .all<OrgRow>()
  ).results;
  return rows;
}

export async function createOrg(env: Bindings, input: OrgInput): Promise<{ org: NormalizedOrg; id: number }> {
  const norm = normalizeOrg(input);
  const res = await env.DB.prepare(
    `INSERT INTO organizations
       (sn, name, ceo_name, phone, email, bank, bank_norm, account_number, lga, state,
        state_norm, project_type, project_category, status, notes, cycle, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')`,
  )
    .bind(
      norm.sn, norm.name, norm.ceo_name, norm.phone, norm.email, norm.bank, norm.bank_norm,
      norm.account_number, norm.lga, norm.state, norm.state_norm, norm.project_type,
      norm.project_category, norm.status, norm.notes, norm.cycle,
    )
    .run();
  const id = Number(res.meta.last_row_id ?? 0);
  return { org: norm, id };
}

export interface OrgUpdateResult {
  id: number;
  changed: string[];
  org: OrgRow | null;
}

const UPDATABLE: Record<string, (n: NormalizedOrg) => unknown> = {
  sn: (n) => n.sn,
  name: (n) => n.name,
  ceo_name: (n) => n.ceo_name,
  phone: (n) => n.phone,
  email: (n) => n.email,
  bank: (n) => n.bank,
  bank_norm: (n) => n.bank_norm,
  account_number: (n) => n.account_number,
  lga: (n) => n.lga,
  state: (n) => n.state,
  state_norm: (n) => n.state_norm,
  project_type: (n) => n.project_type,
  project_category: (n) => n.project_category,
  status: (n) => n.status,
  notes: (n) => n.notes,
  cycle: (n) => n.cycle,
};

export async function updateOrg(env: Bindings, id: number, input: OrgInput): Promise<OrgUpdateResult> {
  const existing = await getOrg(env, id);
  if (!existing) return { id, changed: [], org: null };
  const norm = normalizeOrg(input);
  const changed: string[] = [];
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [col, pick] of Object.entries(UPDATABLE)) {
    const next = pick(norm);
    const prev = (existing as unknown as Record<string, unknown>)[col];
    if (JSON.stringify(next) !== JSON.stringify(prev)) {
      changed.push(col);
      sets.push(`${col} = ?`);
      params.push(next);
    }
  }
  if (!changed.length) return { id, changed, org: existing };
  sets.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`);
  params.push(id);
  await env.DB.prepare(`UPDATE organizations SET ${sets.join(', ')} WHERE id = ?`).bind(...params).run();
  return { id, changed, org: await getOrg(env, id) };
}

/** Soft delete. Returns true when a row was deleted. */
export async function deleteOrg(env: Bindings, id: number): Promise<boolean> {
  const res = await env.DB.prepare(
    `UPDATE organizations SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND deleted_at IS NULL`,
  )
    .bind(id)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

export async function bulkDelete(env: Bindings, ids: number[]): Promise<number> {
  if (!ids.length) return 0;
  const placeholders = ids.map(() => '?').join(', ');
  const res = await env.DB.prepare(
    `UPDATE organizations SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
  )
    .bind(...ids)
    .run();
  return res.meta.changes ?? 0;
}

/** Distinct filter values for the UI (states, categories, banks, cycles). */
export async function filterOptions(env: Bindings): Promise<{
  states: string[]; categories: string[]; banks: string[]; cycles: string[]; statuses: string[];
}> {
  const pick = async (sql: string): Promise<string[]> => {
    const res = await env.DB.prepare(sql).all<{ v: string }>();
    return res.results.map((r) => r.v).filter(Boolean);
  };
  const [states, categories, banks, cycles] = await Promise.all([
    pick(`SELECT DISTINCT state_norm AS v FROM organizations WHERE deleted_at IS NULL AND state_norm IS NOT NULL ORDER BY v`),
    pick(`SELECT DISTINCT project_category AS v FROM organizations WHERE deleted_at IS NULL ORDER BY v`),
    pick(`SELECT DISTINCT bank_norm AS v FROM organizations WHERE deleted_at IS NULL AND bank_norm IS NOT NULL ORDER BY v`),
    pick(`SELECT DISTINCT cycle AS v FROM organizations WHERE deleted_at IS NULL ORDER BY v`),
  ]);
  return { states, categories, banks, cycles, statuses: ['registered', 'in_review', 'approved', 'rejected', 'inactive'] };
}
