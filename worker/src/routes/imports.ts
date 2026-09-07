import { Hono } from 'hono';
import { executeImport, planImport } from '../services/importer';
import { recordAudit } from '../services/audit';
import { userOf, type AppEnv } from '../types';

interface UploadFile {
  name: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const importRoutes = new Hono<AppEnv>();

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
  const { user, ip } = userOf(c);
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

importRoutes.get('/', async (c) => {
  const q = new URL(c.req.url).searchParams;
  const page = Math.max(1, parseInt(q.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(100, parseInt(q.get('pageSize') ?? '10', 10) || 10);
  const totalRow = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM imports').first<{ n: number }>();
  const rows = (
    await c.env.DB.prepare(
      `SELECT id, filename, r2_key, total_rows, created_count, updated_count, skipped_count,
              error_count, status, report, actor_email, created_at
       FROM imports ORDER BY id DESC LIMIT ? OFFSET ?`,
    )
      .bind(pageSize, (page - 1) * pageSize)
      .all<{
        id: number; filename: string; r2_key: string | null; total_rows: number; created_count: number;
        updated_count: number; skipped_count: number; error_count: number; status: string;
        report: string | null; actor_email: string | null; created_at: string;
      }>()
  ).results;
  return c.json({
    data: rows.map((r) => ({ ...r, report: r.report ? safeJson(r.report) : null })),
    meta: {
      total: totalRow?.n ?? 0,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil((totalRow?.n ?? 0) / pageSize)),
    },
  });
});

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
