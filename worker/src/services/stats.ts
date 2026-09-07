import type { Bindings } from '../lib/env';

export interface Stats {
  total: number;
  complete: number;
  incomplete: number;
  duplicates: number;
  statesCovered: number;
  lgasCovered: number;
  byState: { state: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
  missing: { field: string; count: number }[];
  recent: {
    id: number; name: string; sn: number | null; state_norm: string | null;
    project_category: string; status: string; updated_at: string; created_at: string;
  }[];
  recentImports: {
    id: number; filename: string; created_count: number; updated_count: number;
    skipped_count: number; error_count: number; actor_email: string | null; created_at: string;
  }[];
}

export async function getStats(env: Bindings): Promise<Stats> {
  const [totalRow, dupRows, statesRow, lgasRow] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS n,
        SUM(CASE WHEN (
          (ceo_name IS NULL OR ceo_name = '') +
          (phone IS NULL OR phone = '') +
          (email IS NULL OR email = '') +
          (state_norm IS NULL OR state_norm = '') +
          (lga IS NULL OR lga = '') +
          (bank IS NULL OR bank = '') +
          (account_number IS NULL OR account_number = '') +
          (project_type IS NULL OR project_type = '')
        ) = 0 THEN 1 ELSE 0 END) AS complete
       FROM organizations WHERE deleted_at IS NULL`,
    ).first<{ n: number; complete: number | null }>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM organizations o
       WHERE o.deleted_at IS NULL AND
         EXISTS (
           SELECT 1 FROM organizations x
           WHERE x.deleted_at IS NULL AND x.id != o.id
             AND replace(lower(trim(x.name)), ' ', '') = replace(lower(trim(o.name)), ' ', '')
             AND COALESCE(x.state_norm, '') = COALESCE(o.state_norm, '')
         )`,
    ).first<{ n: number }>(),
    env.DB.prepare(
      `SELECT COUNT(DISTINCT state_norm) AS n FROM organizations
       WHERE deleted_at IS NULL AND state_norm IS NOT NULL`,
    ).first<{ n: number }>(),
    env.DB.prepare(
      `SELECT COUNT(DISTINCT lower(trim(lga))) AS n FROM organizations
       WHERE deleted_at IS NULL AND lga IS NOT NULL AND trim(lga) != ''`,
    ).first<{ n: number }>(),
  ]);

  const total = totalRow?.n ?? 0;
  const complete = totalRow?.complete ?? 0;

  const [byState, byCategory, byStatus, missingRows, recent, recentImports] = await Promise.all([
    env.DB.prepare(
      `SELECT COALESCE(state_norm, 'Unknown') AS state, COUNT(*) AS count
       FROM organizations WHERE deleted_at IS NULL
       GROUP BY 1 ORDER BY count DESC, state ASC LIMIT 15`,
    ).all<{ state: string; count: number }>(),
    env.DB.prepare(
      `SELECT project_category AS category, COUNT(*) AS count
       FROM organizations WHERE deleted_at IS NULL
       GROUP BY 1 ORDER BY count DESC`,
    ).all<{ category: string; count: number }>(),
    env.DB.prepare(
      `SELECT status, COUNT(*) AS count FROM organizations WHERE deleted_at IS NULL GROUP BY 1 ORDER BY count DESC`,
    ).all<{ status: string; count: number }>(),
    env.DB.prepare(
      `SELECT
         SUM(CASE WHEN ceo_name IS NULL OR ceo_name = '' THEN 1 ELSE 0 END) AS ceo,
         SUM(CASE WHEN phone IS NULL OR phone = '' THEN 1 ELSE 0 END) AS phone,
         SUM(CASE WHEN email IS NULL OR email = '' THEN 1 ELSE 0 END) AS email,
         SUM(CASE WHEN state_norm IS NULL THEN 1 ELSE 0 END) AS state,
         SUM(CASE WHEN lga IS NULL OR lga = '' THEN 1 ELSE 0 END) AS lga,
         SUM(CASE WHEN bank IS NULL OR bank = '' THEN 1 ELSE 0 END) AS bank,
         SUM(CASE WHEN account_number IS NULL OR account_number = '' THEN 1 ELSE 0 END) AS account,
         SUM(CASE WHEN project_type IS NULL OR project_type = '' THEN 1 ELSE 0 END) AS project
       FROM organizations WHERE deleted_at IS NULL`,
    ).first<Record<string, number | null>>(),
    env.DB.prepare(
      `SELECT id, name, sn, state_norm, project_category, status, created_at, updated_at
       FROM organizations WHERE deleted_at IS NULL ORDER BY updated_at DESC, id DESC LIMIT 6`,
    ).all<{
      id: number; name: string; sn: number | null; state_norm: string | null;
      project_category: string; status: string; updated_at: string; created_at: string;
    }>(),
    env.DB.prepare(
      `SELECT id, filename, created_count, updated_count, skipped_count, error_count, actor_email, created_at
       FROM imports ORDER BY id DESC LIMIT 3`,
    ).all<{
      id: number; filename: string; created_count: number; updated_count: number;
      skipped_count: number; error_count: number; actor_email: string | null; created_at: string;
    }>(),
  ]);

  const m: Record<string, number | null> = missingRows ?? {};
  return {
    total,
    complete,
    incomplete: total - complete,
    duplicates: dupRows?.n ?? 0,
    statesCovered: statesRow?.n ?? 0,
    lgasCovered: lgasRow?.n ?? 0,
    byState: byState.results,
    byCategory: byCategory.results,
    byStatus: byStatus.results,
    missing: [
      { field: 'ceo', count: m.ceo ?? 0 },
      { field: 'phone', count: m.phone ?? 0 },
      { field: 'email', count: m.email ?? 0 },
      { field: 'state', count: m.state ?? 0 },
      { field: 'lga', count: m.lga ?? 0 },
      { field: 'bank', count: m.bank ?? 0 },
      { field: 'account', count: m.account ?? 0 },
      { field: 'project', count: m.project ?? 0 },
    ],
    recent: recent.results,
    recentImports: recentImports.results,
  };
}
