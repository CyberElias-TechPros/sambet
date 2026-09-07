import type { Bindings } from '../lib/env';

export async function recordAudit(
  env: Bindings,
  actorEmail: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  details: unknown,
  ip: string | null,
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO audit_log (actor_email, action, entity, entity_id, details, ip)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(actorEmail, action, entity, entityId, details ? JSON.stringify(details) : null, ip)
      .run();
  } catch (err) {
    console.error('audit insert failed', err);
  }
}

export interface AuditRow {
  id: number;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: string | null;
  ip: string | null;
  created_at: string;
}

export async function listAudit(
  env: Bindings,
  opts: { page: number; pageSize: number; action?: string; actor?: string },
): Promise<{ data: AuditRow[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.action) {
    where.push('action = ?');
    params.push(opts.action);
  }
  if (opts.actor) {
    where.push('actor_email LIKE ?');
    params.push(`%${opts.actor}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS n FROM audit_log ${whereSql}`)
    .bind(...params)
    .first<{ n: number }>();
  const total = totalRow?.n ?? 0;
  const offset = (opts.page - 1) * opts.pageSize;
  const data = (
    await env.DB.prepare(
      `SELECT id, actor_email, action, entity, entity_id, details, ip, created_at
       FROM audit_log ${whereSql}
       ORDER BY id DESC LIMIT ? OFFSET ?`,
    )
      .bind(...params, opts.pageSize, offset)
      .all<AuditRow>()
  ).results;
  return { data, total };
}
