import { Hono } from 'hono';
import type { Bindings } from '../lib/env';
import { getStats } from '../services/stats';
import { listAudit } from '../services/audit';

type Ctx = { Bindings: Bindings };

export const statsRoutes = new Hono<Ctx>();

statsRoutes.get('/', async (c) => {
  return c.json(await getStats(c.env));
});

statsRoutes.get('/audit', async (c) => {
  const q = new URL(c.req.url).searchParams;
  const page = Math.max(1, parseInt(q.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(100, parseInt(q.get('pageSize') ?? '25', 10) || 25);
  const { data, total } = await listAudit(c.env, {
    page,
    pageSize,
    action: q.get('action') ?? undefined,
    actor: q.get('actor') ?? undefined,
  });
  return c.json({
    data: data.map((r) => ({
      ...r,
      details: r.details ? safeJson(r.details) : null,
    })),
    meta: { total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) },
  });
});

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
