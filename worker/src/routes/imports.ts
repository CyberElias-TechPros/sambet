import { Hono, type Context } from 'hono';
import { approveImport, executeImport, isPendingExpired, planImport, rejectImport, submitImport } from '../services/importer';
import { recordAudit } from '../services/audit';
import { userOf, type AppEnv } from '../types';

interface UploadFile {
  name: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const importRoutes = new Hono<AppEnv>();

/** 403 for non-admins; returns the admin's identity otherwise. */
function adminOf(c: Context<AppEnv>): { user: { id: number; email: string; name: string; role: string }; ip: string } | Response {
  const { user, ip } = userOf(c);
  if (user.role !== 'admin') return c.json({ error: 'Admin access required' }, 403);
  return { user, ip };
}

importRoutes.post('/preview', async (c) => {
  const fd = await c.req.formData().catch(() => null);
  if (!fd) return c.json({ error: 'Expected a multipart form with a "file" field' }, 400);
  const file = fd.get('file') as UploadFile | null;
  if (!file || typeof file.arrayBuffer !== 'function' || typeof file.name !== 'string') {
    return c.json({ error: 'No file provided' }, 400);
  }
  if (file.size > MAX_FILE_BYTES) return c.json({ error: 'File is too large (max 10 MB)' }, 400);
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    return c.json({ error: 'Unsupported file type. Upload .xlsx, .xls or .csv' }, 400);
  }
  const strategy = fd.get('strategy') === 'skip' ? 'skip' : 'update';
  try {
    const buf = await file.arrayBuffer();
    const plan = await planImport(c.env, buf, file.name, strategy);
    if (!plan.items.length && !plan.errors.length) {
      return c.json({ error: 'No data rows found in the file (after the header row).' }, 400);
    }
    return c.json({
      data: {
        uploadId: plan.uploadId,
        filename: plan.filename,
        total: plan.total,
        create: plan.create,
        update: plan.update,
        skip: plan.skip,
        errors: plan.errors,
        errorTotal: plan.errors.length,
        warnings: plan.warnings,
        warningTotal: plan.warnings.length,
        headers: plan.headers,
        unmappedHeaders: plan.unmappedHeaders,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not read the file';
    return c.json({ error: msg }, 400);
  }
});

importRoutes.post('/execute', async (c) => {
  const admin = adminOf(c);
  if (admin instanceof Response) return admin;
  const { user, ip } = admin;
  const body = (await c.req.json().catch(() => null)) as {
    uploadId?: string;
    strategy?: string;
  } | null;
  if (!body?.uploadId || typeof body.uploadId !== 'string' || body.uploadId.length > 64) {
    return c.json({ error: 'uploadId is required' }, 400);
  }
  const strategy = body.strategy === 'skip' ? 'skip' : 'update';
  try {
    const result = await executeImport(c.env, body.uploadId, strategy, user.email);
    await recordAudit(c.env, user.email, 'import.completed', 'import', String(result.importId), {
      filename: result.filename,
      total: result.total,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
    }, ip);
    return c.json({ data: result }, 201);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const msg = err instanceof Error ? err.message : 'Import failed';
    return c.json({ error: msg }, status as 410);
  }
});

/** Any authenticated user can submit a finished preview for admin review.
 *  Nothing in the registry is changed until an admin approves. */
importRoutes.post('/submit', async (c) => {
  const { user, ip } = userOf(c);
  const body = (await c.req.json().catch(() => null)) as { uploadId?: string; strategy?: string } | null;
  if (!body?.uploadId || typeof body.uploadId !== 'string' || body.uploadId.length > 64) {
    return c.json({ error: 'uploadId is required' }, 400);
  }
  const strategy = body.strategy === 'skip' ? 'skip' : 'update';
  try {
    const result = await submitImport(c.env, body.uploadId, strategy, user.email);
    await recordAudit(c.env, user.email, 'import.submitted', 'import', String(result.importId), { uploadId: body.uploadId, strategy }, ip);
    return c.json({ data: result }, 201);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const msg = err instanceof Error ? err.message : 'Submission failed';
    return c.json({ error: msg }, status as 409);
  }
});

importRoutes.post('/:id/approve', async (c) => {
  const admin = adminOf(c);
  if (admin instanceof Response) return admin;
  const { user, ip } = admin;
  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id)) return c.json({ error: 'Invalid id' }, 400);
  const body = (await c.req.json().catch(() => null)) as { strategy?: string } | null;
  const strategy = body?.strategy === 'skip' ? 'skip' : 'update';
  try {
    const result = await approveImport(c.env, id, strategy, user.email);
    await recordAudit(c.env, user.email, 'import.approved', 'import', String(id), {
      filename: result.filename, total: result.total, created: result.created, updated: result.updated, skipped: result.skipped,
    }, ip);
    return c.json({ data: result }, 201);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const msg = err instanceof Error ? err.message : 'Approval failed';
    return c.json({ error: msg }, status as 409);
  }
});

importRoutes.post('/:id/reject', async (c) => {
  const admin = adminOf(c);
  if (admin instanceof Response) return admin;
  const { user, ip } = admin;
  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id)) return c.json({ error: 'Invalid id' }, 400);
  const body = (await c.req.json().catch(() => null)) as { reason?: string } | null;
  const reason = body?.reason ? String(body.reason).trim().slice(0, 500) || null : null;
  try {
    const result = await rejectImport(c.env, id, reason, user.email);
    await recordAudit(c.env, user.email, 'import.rejected', 'import', String(id), { reason }, ip);
    return c.json({ data: result });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const msg = err instanceof Error ? err.message : 'Rejection failed';
    return c.json({ error: msg }, status as 409);
  }
});

/** Download the archived original file (admin, or the submitter). */
importRoutes.get('/:id/file', async (c) => {
  const { user } = userOf(c);
  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id)) return c.json({ error: 'Invalid id' }, 400);
  const row = await c.env.DB.prepare('SELECT filename, r2_key, actor_email, status FROM imports WHERE id = ?')
    .bind(id)
    .first<{ filename: string; r2_key: string | null; actor_email: string | null; status: string }>();
  if (!row || !row.r2_key) return c.json({ error: 'No file archived for this import' }, 404);
  if (user.role !== 'admin' && row.actor_email !== user.email) {
    return c.json({ error: 'Admin access required' }, 403);
  }
  const obj = await c.env.FILES.get(row.r2_key);
  if (!obj) return c.json({ error: 'File no longer available' }, 410);
  const safe = row.filename.replace(/"/g, '');
  return new Response(new ReadableStream({
    async start(controller) {
      const reader = obj.body?.getReader();
      if (!reader) { controller.close(); return; }
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        controller.enqueue(value);
      }
      controller.close();
    },
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safe}"`,
    },
  });
});

importRoutes.get('/', async (c) => {
  const q = new URL(c.req.url).searchParams;
  const page = Math.max(1, parseInt(q.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(100, parseInt(q.get('pageSize') ?? '10', 10) || 10);
  const status = q.get('status') ?? undefined;
  const where = status ? 'WHERE status = ?' : '';
  const totalRow = status
    ? await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM imports ${where}`).bind(status).first<{ n: number }>()
    : await c.env.DB.prepare('SELECT COUNT(*) AS n FROM imports').first<{ n: number }>();
  const base =
    `SELECT id, filename, r2_key, total_rows, created_count, updated_count, skipped_count,
            error_count, status, report, actor_email, reviewed_by, reviewed_at,
            rejection_reason, created_at
     FROM imports ${where} ORDER BY id DESC LIMIT ? OFFSET ?`;
  const rows = (
    status
      ? await c.env.DB.prepare(base).bind(status, pageSize, (page - 1) * pageSize).all<ImportRow>()
      : await c.env.DB.prepare(base).bind(pageSize, (page - 1) * pageSize).all<ImportRow>()
  ).results;
  return c.json({
    data: rows.map((r) => ({
      ...r,
      report: r.report ? safeJson(r.report) : null,
      expired: r.status === 'pending' && isPendingExpired(r.created_at),
    })),
    meta: {
      total: totalRow?.n ?? 0,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil((totalRow?.n ?? 0) / pageSize)),
    },
  });
});

interface ImportRow {
  id: number;
  filename: string;
  r2_key: string | null;
  total_rows: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  status: string;
  report: string | null;
  actor_email: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
