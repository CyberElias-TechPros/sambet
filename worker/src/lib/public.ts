import type { Bindings } from './env';

/**
 * Human-friendly submission reference: SAM-<year>-<id padded to 5 digits>.
 * Pure function of the row id so it is stable, sortable and guess-safe enough
 * for a low-volume public status lookup (the secret part is that nobody can
 * see other people's data through it — only coarse status).
 */
export function makeReference(id: number, now: Date = new Date()): string {
  return `SAM-${now.getUTCFullYear()}-${String(id).padStart(5, '0')}`;
}

export type MatchType = 'phone' | 'account' | 'name+state';

export interface OrgMatch {
  id: number;
  name: string;
  phone: string | null;
  state_norm: string | null;
  match: MatchType;
}

const PRIORITY: Record<MatchType, number> = { phone: 0, account: 1, 'name+state': 2 };

/**
 * Find live registry organizations that could be the same entity as a
 * submission — used to warn submitters, guide reviewers, and guard against
 * duplicate entries at verification time. Strongest signal first.
 */
export async function matchOrgsForSubmission(
  env: Bindings,
  input: { phone: string; account_number: string; name: string; state: string | null },
  excludeOrgId?: number,
): Promise<OrgMatch[]> {
  const out = new Map<number, OrgMatch>();
  const add = (row: { id: number; name: string; phone: string | null; state_norm: string | null } | null, match: MatchType) => {
    if (!row) return;
    const cur = out.get(row.id);
    if (!cur || PRIORITY[match] < PRIORITY[cur.match]) out.set(row.id, { ...row, match });
  };

  if (input.phone) {
    const r = await env.DB.prepare(
      `SELECT id, name, phone, state_norm FROM organizations WHERE deleted_at IS NULL AND id != ? AND phone = ? LIMIT 10`,
    )
      .bind(excludeOrgId ?? -1, input.phone)
      .first();
    add(r as OrgMatch | null, 'phone');
  }
  if (input.account_number) {
    const r = await env.DB.prepare(
      `SELECT id, name, phone, state_norm FROM organizations WHERE deleted_at IS NULL AND id != ? AND account_number = ? LIMIT 10`,
    )
      .bind(excludeOrgId ?? -1, input.account_number)
      .first();
    add(r as OrgMatch | null, 'account');
  }
  if (input.name) {
    const r = await env.DB.prepare(
      `SELECT id, name, phone, state_norm FROM organizations
       WHERE deleted_at IS NULL AND id != ?
         AND replace(lower(trim(name)), ' ', '') = replace(lower(trim(?)), ' ', '')
         AND COALESCE(state_norm, '') = COALESCE(?, '')
       LIMIT 10`,
    )
      .bind(excludeOrgId ?? -1, input.name, input.state ?? '')
      .first();
    add(r as OrgMatch | null, 'name+state');
  }
  return [...out.values()].sort((a, b) => a.id - b.id);
}

export interface TrendDay {
  date: string; // YYYY-MM-DD
  total: number;
  verified: number;
  rejected: number;
  pending: number;
}

/** Fill the last `days` days (ending today) with zeros where no rows exist. */
export function fillTrendDays(
  rows: { date: string; total: number; verified: number | null; rejected: number | null }[],
  days = 14,
): TrendDay[] {
  const map = new Map<string, { total: number; verified: number; rejected: number }>();
  for (const r of rows) {
    map.set(r.date, { total: Number(r.total) || 0, verified: Number(r.verified) || 0, rejected: Number(r.rejected) || 0 });
  }
  const out: TrendDay[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const v = map.get(key) ?? { total: 0, verified: 0, rejected: 0 };
    out.push({ date: key, total: v.total, verified: v.verified, rejected: v.rejected, pending: Math.max(0, v.total - v.verified - v.rejected) });
  }
  return out;
}
