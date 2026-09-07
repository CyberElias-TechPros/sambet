import { Hono, type Context } from 'hono';
import { userOf, type AppEnv } from '../types';
import { fillTrendDays, matchOrgsForSubmission } from '../lib/public';
import { recordAudit } from '../services/audit';
import { normalizePhone } from '../lib/normalize';
import { orgInputSchema, zodFieldErrors } from '../lib/validate';
import { createOrg } from '../services/organizations';

const subs = new Hono<AppEnv>();

const COLS = `id, reference, org_name, phone, state, bank, account_number, account_name,
  amount_paid, payment_date, payment_reference, notes, status, org_id, reviewed_by,
  reviewed_at, rejection_reason, created_at, pop_key`;

/** 403 for non-admins; returns the admin's identity otherwise. */
function adminOf(c: Context<AppEnv>) {
  const { user, ip } = userOf(c);
  if (user.role !== 'admin') return c.json({ error: 'Admin access required' }, 403) as Response;
  return { user, ip };
}

/* list + tab summary */
subs.get('/', async (c) => {
  const q = new URL(c.req.url).searchParams;
  const status = q.get('status') ?? '';
  const search = (q.get('q') ?? '').trim();
  const page = Math.max(1, parseInt(q.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(q.get('pageSize') ?? '20', 10) || 20));

  const where: string[] = [];
  const params: (string | number)[] = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (search) {
    where.push('(reference LIKE ? OR org_name LIKE ? OR phone LIKE ? OR account_number LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total =
    (await c.env.DB.prepare(`SELECT COUNT(*) AS t FROM submissions ${whereSql}`).bind(...params).first<{ t: number }>())?.t ?? 0;
  const rows = await c.env.DB.prepare(
    `SELECT ${COLS} FROM submissions ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
  )
    .bind(...params, pageSize, (page - 1) * pageSize)
    .all();

  const summaryRows = await c.env.DB.prepare(`SELECT status, COUNT(*) AS t FROM submissions GROUP BY status`).all<{ status: string; t: number }>();
  const summary = { pending: 0, verified: 0, rejected: 0 };
  for (const r of summaryRows.results) summary[r.status as keyof typeof summary] = (summary[r.status as keyof typeof summary] ?? 0) + r.t;

  return c.json({ data: rows.results, meta: { total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }, summary });
});

/* analytics for the dashboard band */
subs.get('/stats', async (c) => {
  const db = c.env.DB;
  const countOf = async (sql: string, ...p: (string | number)[]) =>
    (await db.prepare(sql).bind(...p).first<{ t: number }>())?.t ?? 0;

  const counts = {
    pending: await countOf(`SELECT COUNT(*) AS t FROM submissions WHERE status = 'pending'`),
    verified: await countOf(`SELECT COUNT(*) AS t FROM submissions WHERE status = 'verified'`),
    rejected: await countOf(`SELECT COUNT(*) AS t FROM submissions WHERE status = 'rejected'`),
    today: await countOf(`SELECT COUNT(*) AS t FROM submissions WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','start of day')`),
    week: await countOf(`SELECT COUNT(*) AS t FROM submissions WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days','start of day')`),
    month: await countOf(`SELECT COUNT(*) AS t FROM submissions WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-29 days','start of day')`),
  };

  const sumOf = async (sql: string, ...p: (string | number)[]) =>
    (await db.prepare(sql).bind(...p).first<{ t: number }>())?.t ?? 0;
  const naira = {
    pending: await sumOf(`SELECT COALESCE(SUM(amount_paid),0) AS t FROM submissions WHERE status = 'pending'`),
    verified: await sumOf(`SELECT COALESCE(SUM(amount_paid),0) AS t FROM submissions WHERE status = 'verified'`),
    last30d: await sumOf(
      `SELECT COALESCE(SUM(amount_paid),0) AS t FROM submissions
       WHERE status != 'rejected' AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-29 days','start of day')`,
    ),
  };

  const trendRows = await db
    .prepare(
      `SELECT date(created_at) AS date, COUNT(*) AS total,
              COALESCE(SUM(status = 'verified'),0) AS verified,
              COALESCE(SUM(status = 'rejected'),0) AS rejected
       FROM submissions
       WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-13 days','start of day')
       GROUP BY date ORDER BY date`,
    )
    .all<{ date: string; total: number; verified: number; rejected: number }>();
  const trend = fillTrendDays(trendRows.results);

  const stateRows = await db
    .prepare(
      `SELECT state FROM submissions
       WHERE state IS NOT NULL AND state != ''
         AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-179 days')`,
    )
    .all<{ state: string }>();
  const byState = new Map<string, number>();
  for (const r of stateRows.results) byState.set(r.state, (byState.get(r.state) ?? 0) + 1);
  const topStates = [...byState.entries()].map(([state, count]) => ({ state, count })).sort((a, b) => b.count - a.count).slice(0, 6);

  return c.json({ counts, naira, trend, topStates });
});

/* detail (with matches + signed POP url) */
subs.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const row = (await c.env.DB.prepare(`SELECT ${COLS} FROM submissions WHERE id = ?`).bind(id).first()) as Record<string, unknown> | null;
  if (!row) return c.json({ error: 'Submission not found' }, 404);

  const matches = await matchOrgsForSubmission(
    c.env,
    {
      phone: row.phone as string,
      account_number: row.account_number as string,
      name: row.org_name as string,
      state: (row.state as string | null) ?? null,
    },
    row.org_id ? (row.org_id as number) : undefined,
  );

  const reviewer = row.reviewed_by
    ? ((await c.env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(row.reviewed_by as number).first<{ name: string }>())?.name ?? null)
    : null;

  return c.json({ data: { ...row, matches, pop_url: row.pop_key ? `/api/submissions/${id}/pop` : null, reviewer } });
});

/* proof-of-payment image (authenticated — staff only) */
subs.get('/:id/pop', async (c) => {
  const id = Number(c.req.param('id'));
  const row = await c.env.DB.prepare('SELECT pop_key, reference FROM submissions WHERE id = ?').bind(id).first<{ pop_key: string; reference: string }>();
  if (!row) return c.json({ error: 'Submission not found' }, 404);
  const obj = await c.env.FILES.get(row.pop_key);
  if (!obj) return c.json({ error: 'Image no longer available' }, 410);
  const contentType = obj.httpMetadata?.contentType ?? 'application/octet-stream';
  const ref = row.reference.replace(/[^A-Z0-9-]/gi, '');
  const base = contentType.split('/')[1] ?? 'img';
  return new Response(obj.body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${ref}.${base === 'jpeg' ? 'jpg' : base}"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
});

/* verify (admin): add to registry, or link to an existing organization */
subs.post('/:id/verify', async (c) => {
  const admin = adminOf(c);
  if (admin instanceof Response) return admin;
  const id = Number(c.req.param('id'));
  const row = (await c.env.DB.prepare(`SELECT ${COLS} FROM submissions WHERE id = ?`).bind(id).first()) as Record<string, unknown> | null;
  if (!row) return c.json({ error: 'Submission not found' }, 404);
  if (row.status !== 'pending') return c.json({ error: 'This submission has already been reviewed' }, 409);

  const body = (await c.req.json().catch(() => null)) as { action?: string; orgId?: number; org?: Record<string, unknown> } | null;
  if (!body || (body.action !== 'create' && body.action !== 'link')) {
    return c.json({ error: 'action must be "create" or "link"' }, 400);
  }
  const now = new Date().toISOString();

  if (body.action === 'link') {
    const orgId = Number(body.orgId);
    if (!Number.isInteger(orgId) || orgId <= 0) return c.json({ error: 'Choose the organization to link' }, 400);
    const org = await c.env.DB.prepare('SELECT id, name FROM organizations WHERE id = ? AND deleted_at IS NULL').bind(orgId).first<{ id: number; name: string }>();
    if (!org) return c.json({ error: 'Choose an existing organization to link' }, 400);
    await c.env.DB.prepare(
      `UPDATE submissions SET status = 'verified', org_id = ?, reviewed_by = ?, reviewed_at = ?, rejection_reason = NULL WHERE id = ?`,
    )
      .bind(org.id, admin.user.id, now, id)
      .run();
    await recordAudit(c.env, admin.user.email, 'submission.verified', 'submission', row.reference as string, {
      action: 'link',
      org_id: org.id,
      org: org.name,
      amount: row.amount_paid,
    }, admin.ip);
    return c.json({ data: { reference: row.reference, status: 'verified', org: { id: org.id, name: org.name } } });
  }

  // action === 'create'
  const parsed = orgInputSchema.safeParse(body.org ?? {});
  if (!parsed.success) return c.json({ error: 'The organization details are incomplete', fields: zodFieldErrors(parsed) }, 400);

  // Strong-duplicate guard: an exact phone or account number already in the
  // registry means we would create a duplicate — force a link decision.
  // Compare on the same normalized values the registry stores.
  const gPhone = normalizePhone(parsed.data.phone ?? '');
  const gAccount = (parsed.data.account_number ?? '').replace(/\D/g, '');
  const strong = await c.env.DB.prepare(
    `SELECT id, name, phone, state_norm FROM organizations
     WHERE deleted_at IS NULL AND (? <> '' AND phone = ? OR ? <> '' AND account_number = ?)
     LIMIT 5`,
  )
    .bind(gPhone, gPhone, gAccount, gAccount)
    .all<{ id: number; name: string; phone: string | null; state_norm: string | null }>();
  if (strong.results.length) {
    return c.json(
      {
        error: 'An organization with this phone or account number is already in the registry',
        matches: strong.results.map((o) => ({ ...o, match: 'phone' as const })),
      },
      409,
    );
  }

  const { org, id: orgId } = await createOrg(c.env, parsed.data, 'public');
  await c.env.DB.prepare(
    `UPDATE submissions SET status = 'verified', org_id = ?, reviewed_by = ?, reviewed_at = ?, rejection_reason = NULL WHERE id = ?`,
  )
    .bind(orgId, admin.user.id, now, id)
    .run();
  await recordAudit(c.env, admin.user.email, 'submission.verified', 'submission', row.reference as string, {
    action: 'create',
    org_id: orgId,
    org: org.name,
    amount: row.amount_paid,
  }, admin.ip);
  return c.json({ data: { reference: row.reference, status: 'verified', org: { id: orgId, name: org.name } } });
});

/* reject (admin): with a reason the team (and status page) can see */
subs.post('/:id/reject', async (c) => {
  const admin = adminOf(c);
  if (admin instanceof Response) return admin;
  const id = Number(c.req.param('id'));
  const row = (await c.env.DB.prepare(`SELECT ${COLS} FROM submissions WHERE id = ?`).bind(id).first()) as Record<string, unknown> | null;
  if (!row) return c.json({ error: 'Submission not found' }, 404);
  if (row.status !== 'pending') return c.json({ error: 'This submission has already been reviewed' }, 409);

  const body = (await c.req.json().catch(() => null)) as { reason?: string } | null;
  const reason = (body?.reason ?? '').trim();
  if (reason.length < 5) return c.json({ error: 'Give a short reason (at least 5 characters)' }, 400);
  if (reason.length > 500) return c.json({ error: 'Keep the reason under 500 characters' }, 400);

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE submissions SET status = 'rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?`,
  )
    .bind(reason, admin.user.id, now, id)
    .run();
  await recordAudit(c.env, admin.user.email, 'submission.rejected', 'submission', row.reference as string, {
    reason,
    amount: row.amount_paid,
  }, admin.ip);
  return c.json({ data: { reference: row.reference, status: 'rejected' } });
});

export const submissionRoutes = subs;
