import { Hono } from 'hono';
import type { Bindings } from '../lib/env';
import { POP_MAX_BYTES, popFileExt, publicSubmissionSchema, zodFieldErrors } from '../lib/validate';
import { makeReference, matchOrgsForSubmission } from '../lib/public';
import { cleanText, normalizePhone, normalizeState } from '../lib/normalize';
import { recordAudit } from '../services/audit';

const pub = new Hono<{ Bindings: Bindings }>();

interface PopFile {
  name?: string;
  size: number;
  type?: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

function ipOf(c: { req: { header(k: string): string | undefined } }): string {
  return c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

/**
 * Public self-registration. The organization pays the fee by bank transfer,
 * then submits its details with a picture of the proof of payment. Rate
 * limited per IP in app.ts (8/hour) + honeypot field for bots.
 */
pub.post('/submit', async (c) => {
  const env = c.env;
  const ip = ipOf(c);
  const fd = await c.req.formData().catch(() => null);
  if (!fd) return c.json({ error: 'Expected a form with your details and a proof-of-payment picture' }, 400);

  // Honeypot: real users never see or fill this field.
  if (String(fd.get('website') ?? '').trim()) return c.json({ error: 'Submission rejected' }, 400);

  // FormData returns null for absent fields; the zod schema speaks undefined.
  const raw = (k: string) => {
    const v = fd.get(k);
    return typeof v === 'string' ? v : undefined;
  };
  const parsed = publicSubmissionSchema.safeParse({
    org_name: raw('org_name'),
    phone: raw('phone'),
    state: raw('state'),
    bank: raw('bank'),
    account_number: raw('account_number'),
    account_name: raw('account_name'),
    amount_paid: raw('amount_paid'),
    payment_date: raw('payment_date'),
    payment_reference: raw('payment_reference'),
    notes: raw('notes'),
  });
  if (!parsed.success) return c.json({ error: 'Please fix the highlighted fields', fields: zodFieldErrors(parsed) }, 400);
  const v = parsed.data;

  const file = fd.get('pop') as PopFile | null;
  if (!file || typeof file.arrayBuffer !== 'function') return c.json({ error: 'Upload a picture of your proof of payment' }, 400);
  if (file.size > POP_MAX_BYTES) return c.json({ error: 'The image is too large (max 6 MB)' }, 400);
  const ext = popFileExt(typeof file.name === 'string' ? file.name : undefined, file.type ?? null);
  if (!ext) return c.json({ error: 'Upload a JPG, PNG or WebP picture' }, 400);

  const phone = normalizePhone(v.phone) ?? v.phone.trim();
  const account = v.account_number.replace(/\D/g, '');
  const stateNorm = v.state ? normalizeState(v.state) : null;

  const ins = await env.DB.prepare(
    `INSERT INTO submissions
       (reference, org_name, phone, state, bank, account_number, account_name,
        amount_paid, payment_date, payment_reference, notes, pop_key, status)
     VALUES ('', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'pending')`,
  )
    .bind(
      cleanText(v.org_name),
      phone,
      stateNorm ?? v.state,
      cleanText(v.bank),
      account,
      v.account_name,
      v.amount_paid,
      v.payment_date,
      v.payment_reference,
      v.notes,
    )
    .run();
  const id = Number(ins.meta.last_row_id ?? 0);
  if (!id) return c.json({ error: 'Could not save the submission. Please try again.' }, 500);
  const reference = makeReference(id);
  const popKey = `submissions/${reference}/pop.${ext}`;
  const buf = new Uint8Array(await file.arrayBuffer());
  await env.FILES.put(popKey, buf, { httpMetadata: { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` } });
  await env.DB.prepare('UPDATE submissions SET reference = ?, pop_key = ? WHERE id = ?').bind(reference, popKey, id).run();

  const matches = await matchOrgsForSubmission(env, { phone, account_number: account, name: v.org_name, state: stateNorm });
  await recordAudit(env, null, 'submission.public', 'submission', reference, {
    amount: v.amount_paid,
    matches: matches.length,
    state: stateNorm ?? v.state ?? null,
  }, ip);

  return c.json({ data: { id, reference, status: 'pending', matches } }, 201);
});

/**
 * Public status lookup. Deliberately coarse — the submitter can only see
 * their own coarse status, never other fields or other submissions.
 */
pub.get('/status/:reference', async (c) => {
  const reference = (c.req.param('reference') ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{5,30}$/.test(reference)) return c.json({ error: 'Enter a reference like SAM-2026-00001' }, 400);
  const row = await c.env.DB.prepare(
    `SELECT reference, status, created_at, org_id, rejection_reason FROM submissions WHERE reference = ?`,
  )
    .bind(reference)
    .first<{ reference: string; status: string; created_at: string; org_id: number | null; rejection_reason: string | null }>();
  if (!row) return c.json({ error: 'No submission found with that reference' }, 404);
  let orgName: string | null = null;
  if (row.org_id) {
    orgName = (await c.env.DB.prepare('SELECT name FROM organizations WHERE id = ?').bind(row.org_id).first<{ name: string }>())?.name ?? null;
  }
  return c.json({
    data: {
      reference: row.reference,
      status: row.status,
      created_at: row.created_at,
      org_name: orgName,
      reason: row.status === 'rejected' ? row.rejection_reason : null,
    },
  });
});

export const publicRoutes = pub;
