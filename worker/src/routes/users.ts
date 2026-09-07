import { Hono, type Context } from 'hono';
import { hashPassword } from '../auth/password';
import { rateLimit } from '../auth/rate-limit';
import { recordAudit } from '../services/audit';
import { userCreateSchema, userUpdateSchema, USER_ROLES, type UserRole, zodFieldErrors } from '../lib/validate';
import { userOf, type AppEnv } from '../types';

export const userRoutes = new Hono<AppEnv>();

function ipOf(c: Context<AppEnv>): string {
  return c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

function adminOf(c: Context<AppEnv>): { user: { id: number; email: string; name: string; role: string }; ip: string } | Response {
  const { user, ip } = userOf(c);
  if (user.role !== 'admin') return c.json({ error: 'Admin access required' }, 403);
  return { user, ip };
}

/** Cryptographically random temp password (always satisfies the policy). */
export function generateTempPassword(): string {
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  const all = lower + upper + digits + symbols;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const byte = (i: number): number => (bytes[i % bytes.length] ?? 0);
  const pick = (s: string, i: number): string => s.charAt(byte(i) % s.length);
  // Guarantee one of each class, then fill the rest at random.
  const chars = [pick(lower, 0), pick(upper, 1), pick(digits, 2), pick(symbols, 3)];
  for (let i = 0; i < 12; i++) chars.push(pick(all, 4 + i));
  // Fisher–Yates shuffle (CSPRNG-driven).
  for (let i = chars.length - 1; i > 0; i--) {
    const j = (byte(i + 7) + byte(i + 11)) % (i + 1);
    const a = chars[i] ?? '';
    const b = chars[j] ?? '';
    chars[i] = b;
    chars[j] = a;
  }
  return chars.join('');
}

const LIST_COLS = `id, name, email, role, created_at, last_login_at, disabled_at`;

userRoutes.get('/', async (c) => {
  const admin = adminOf(c);
  if (admin instanceof Response) return admin;
  const rows = await c.env.DB.prepare(`SELECT ${LIST_COLS} FROM users ORDER BY created_at`).all<{
    id: number; name: string; email: string; role: string; created_at: string;
    last_login_at: string | null; disabled_at: string | null;
  }>();
  return c.json({ data: rows.results });
});

userRoutes.post('/', async (c) => {
  const admin = adminOf(c);
  if (admin instanceof Response) return admin;
  const { user, ip } = admin;
  const parsed = userCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid input', fields: zodFieldErrors(parsed) }, 400);
  const { name, email, password, role } = parsed.data;

  const exists = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (exists) return c.json({ error: 'That e-mail is already registered.', fields: { email: 'E-mail already in use' } }, 409);

  const hash = await hashPassword(password);
  const res = await c.env.DB.prepare('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)')
    .bind(email, name, hash, role)
    .run();
  const id = Number(res.meta.last_row_id ?? 0);
  await recordAudit(c.env, user.email, 'user.created', 'user', String(id), { name, email, role }, ip);
  return c.json({ data: { id, name, email, role, created_at: new Date().toISOString() } }, 201);
});

userRoutes.patch('/:id', async (c) => {
  const admin = adminOf(c);
  if (admin instanceof Response) return admin;
  const { user, ip } = admin;
  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id)) return c.json({ error: 'Invalid id' }, 400);
  if (id === user.id) {
    return c.json({ error: 'You cannot change your own role or disable yourself.' }, 400);
  }
  const parsed = userUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid input', fields: zodFieldErrors(parsed) }, 400);
  const { role, disabled } = parsed.data;
  if (role === undefined && disabled === undefined) return c.json({ error: 'Nothing to update' }, 400);
  if (role !== undefined && !(USER_ROLES as readonly string[]).includes(role)) {
    return c.json({ error: 'Invalid role' }, 400);
  }

  const target = await c.env.DB.prepare('SELECT id, email, role, disabled_at FROM users WHERE id = ?')
    .bind(id)
    .first<{ id: number; email: string; role: string; disabled_at: string | null }>();
  if (!target) return c.json({ error: 'User not found' }, 404);

  // Never lock the team out: keep at least one active admin.
  if ((disabled === true || role === 'editor') && target.role === 'admin' && target.disabled_at == null) {
    const activeAdmins = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND disabled_at IS NULL AND id != ?`,
    ).bind(id).first<{ n: number }>();
    if ((activeAdmins?.n ?? 0) === 0) {
      return c.json({ error: 'This would leave no active admin. Enable or promote another admin first.' }, 400);
    }
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare('UPDATE users SET role = COALESCE(?, role), disabled_at = ? WHERE id = ?')
    .bind(role ?? null, disabled === undefined ? target.disabled_at : (disabled ? now : null), id)
    .run();
  await recordAudit(c.env, user.email, 'user.updated', 'user', String(id), {
    email: target.email, ...(role ? { role } : {}), ...(disabled !== undefined ? { disabled } : {}),
  }, ip);
  return c.json({ ok: true });
});

userRoutes.post('/:id/reset-password', async (c) => {
  const admin = adminOf(c);
  if (admin instanceof Response) return admin;
  const { user, ip } = admin;
  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id)) return c.json({ error: 'Invalid id' }, 400);
  const target = await c.env.DB.prepare('SELECT id, email FROM users WHERE id = ?').bind(id).first<{ id: number; email: string }>();
  if (!target) return c.json({ error: 'User not found' }, 404);
  const temp = generateTempPassword();
  const hash = await hashPassword(temp);
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, id).run();
  // Force a fresh session: all existing sessions for this user are dropped.
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
  await recordAudit(c.env, user.email, 'password.reset', 'user', String(id), { email: target.email }, ip);
  // The temp password is shown exactly once.
  return c.json({ data: { email: target.email, tempPassword: temp } });
});
