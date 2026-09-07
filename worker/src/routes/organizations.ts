import { Hono } from 'hono';
import { orgInputSchema, zodFieldErrors, type OrgInput } from '../lib/validate';
import { normalizeOrg } from '../lib/normalize-org';
import {
  bulkDelete,
  createOrg,
  deleteOrg,
  filterOptions,
  findDuplicates,
  getOrg,
  listOrgs,
  missingFields,
  updateOrg,
  type OrgFilters,
  type OrgRow,
} from '../services/organizations';
import { exportOrgs, importTemplateXlsx } from '../services/exporter';
import { recordAudit } from '../services/audit';
import { userOf, type AppEnv } from '../types';
import type { Bindings } from '../lib/env';

export const orgRoutes = new Hono<AppEnv>();

function filtersFromQuery(url: URL): OrgFilters {
  const q = url.searchParams;
  const bool = (k: string) => q.get(k) === '1' || q.get(k) === 'true';
  return {
    search: q.get('search') ?? undefined,
    state: q.get('state') ?? undefined,
    category: q.get('category') ?? undefined,
    bank: q.get('bank') ?? undefined,
    status: q.get('status') ?? undefined,
    cycle: q.get('cycle') ?? undefined,
    incomplete: bool('incomplete') || undefined,
    duplicate: bool('duplicate') || undefined,
    sort: (q.get('sort') as OrgFilters['sort']) || undefined,
    order: (q.get('order') as OrgFilters['order']) || undefined,
    page: q.get('page') ? parseInt(q.get('page')!, 10) : undefined,
    pageSize: q.get('pageSize') ? parseInt(q.get('pageSize')!, 10) : undefined,
  };
}

function orgPayload(o: OrgRow) {
  return {
    ...o,
    is_duplicate: !!o.is_duplicate,
    missing: missingFields(o),
  };
}

orgRoutes.get('/', async (c) => {
  const f = filtersFromQuery(new URL(c.req.url));
  const { data, total } = await listOrgs(c.env, f);
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 25));
  return c.json({
    data: data.map(orgPayload),
    meta: { total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) },
  });
});

orgRoutes.get('/options', async (c) => {
  return c.json(await filterOptions(c.env));
});

orgRoutes.get('/export', async (c) => {
  const format = (new URL(c.req.url).searchParams.get('format') ?? 'xlsx') as 'xlsx' | 'csv';
  if (format !== 'xlsx' && format !== 'csv') return c.json({ error: 'format must be xlsx or csv' }, 400);
  const { body, filename, contentType } = await exportOrgs(c.env, filtersFromQuery(new URL(c.req.url)), format);
  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
});

orgRoutes.get('/template', (c) => {
  const { body, filename } = importTemplateXlsx();
  return new Response(body, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
});

orgRoutes.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id)) return c.json({ error: 'Invalid id' }, 400);
  const org = await getOrg(c.env, id);
  if (!org) return c.json({ error: 'Organization not found' }, 404);
  const dups = await findDuplicates(c.env, org);
  return c.json({ data: { ...orgPayload(org), duplicates: dups.map(orgPayload) } });
});

orgRoutes.post('/', async (c) => {
  const { user, ip } = userOf(c);
  const parsed = orgInputSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid input', fields: zodFieldErrors(parsed) }, 400);
  const input = parsed.data as OrgInput;
  const existing = await getOrgByDupKey(c.env, input);
  if (existing) {
    return c.json(
      {
        error: `An organization with this name already exists (#${existing.id}). Edit that record, or use a different name.`,
        fields: { name: 'Duplicate organization' },
        duplicateId: existing.id,
      },
      409,
    );
  }
  let result: { org: ReturnType<typeof normalizeOrg>; id: number };
  try {
    result = await createOrg(c.env, input);
  } catch (err) {
    // e.g. the S/N of a soft-deleted record (the UNIQUE index still holds it)
    if (String(err).includes('UNIQUE constraint failed')) {
      return c.json(
        {
          error:
            input.sn != null
              ? `S/N ${input.sn} is already in use by a (deleted) record. Choose a different S/N.`
              : 'This record conflicts with an existing one.',
          fields: { sn: 'S/N already in use' },
        },
        409,
      );
    }
    throw err;
  }
  const { id, org } = result;
  await recordAudit(c.env, user.email, 'org.create', 'organization', String(id), { name: org.name }, ip);
  return c.json({ data: { id, ...org } }, 201);
});

orgRoutes.patch('/:id', async (c) => {
  const { user, ip } = userOf(c);
  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id)) return c.json({ error: 'Invalid id' }, 400);
  const existing = await getOrg(c.env, id);
  if (!existing) return c.json({ error: 'Organization not found' }, 404);
  const body = (await c.req.json().catch(() => null)) ?? {};
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Invalid input' }, 400);
  }
  // Name is immutable — but tolerate clients that echo it back unchanged.
  if (body.name !== undefined && String(body.name).trim() !== existing.name) {
    return c.json(
      { error: 'The organization name cannot be changed. Create a new record instead.', fields: { name: 'Name is immutable' } },
      400,
    );
  }
  // True partial update: overlay the patch on the existing raw values so omitted
  // fields keep their current data (never blanked by a partial edit).
  const merged = {
    sn: existing.sn,
    ceo_name: existing.ceo_name,
    phone: existing.phone,
    email: existing.email,
    bank: existing.bank,
    account_number: existing.account_number,
    lga: existing.lga,
    state: existing.state,
    project_type: existing.project_type,
    status: existing.status,
    notes: existing.notes,
    cycle: existing.cycle,
    ...body,
    name: existing.name,
  };
  const parsed = orgInputSchema.safeParse(merged);
  if (!parsed.success) return c.json({ error: 'Invalid input', fields: zodFieldErrors(parsed) }, 400);
  const { changed, org } = await updateOrg(c.env, id, parsed.data as OrgInput);
  await recordAudit(c.env, user.email, 'org.update', 'organization', String(id), { changed }, ip);
  return c.json({ data: { ...(org ? orgPayload(org) : null), changed } });
});

orgRoutes.delete('/:id', async (c) => {
  const { user, ip } = userOf(c);
  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id)) return c.json({ error: 'Invalid id' }, 400);
  const existing = await getOrg(c.env, id);
  if (!existing) return c.json({ error: 'Organization not found' }, 404);
  await deleteOrg(c.env, id);
  await recordAudit(c.env, user.email, 'org.delete', 'organization', String(id), { name: existing.name }, ip);
  return c.json({ ok: true });
});

orgRoutes.post('/bulk-delete', async (c) => {
  const { user, ip } = userOf(c);
  const body = (await c.req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? (body!.ids as unknown[])
        .map((v) => parseInt(String(v), 10))
        .filter((v) => Number.isFinite(v) && v > 0)
        .slice(0, 500)
    : [];
  if (!ids.length) return c.json({ error: 'No valid ids provided' }, 400);
  const n = await bulkDelete(c.env, ids);
  await recordAudit(c.env, user.email, 'org.bulk_delete', 'organization', null, { count: n, ids: ids.slice(0, 50) }, ip);
  return c.json({ ok: true, deleted: n });
});

async function getOrgByDupKey(env: Bindings, input: OrgInput): Promise<OrgRow | null> {
  const n = normalizeOrg(input);
  if (!n.state_norm) return null; // only flag duplicates when state is known
  const row = await env.DB.prepare(
    `SELECT * FROM organizations
     WHERE deleted_at IS NULL
       AND replace(lower(trim(name)), ' ', '') = replace(lower(trim(?)), ' ', '')
       AND state_norm = ?
     LIMIT 1`,
  )
    .bind(n.name, n.state_norm)
    .first<OrgRow>();
  return row ?? null;
}
