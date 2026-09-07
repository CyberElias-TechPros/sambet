import { Hono } from 'hono';
import type { Bindings } from '../lib/env';
import { cookieSecureFor, isAllowedOrigin } from '../lib/env';
import { loginSchema, passwordChangeSchema, setupSchema, zodFieldErrors } from '../lib/validate';
import { hashPassword, verifyPassword } from '../auth/password';
import {
  createSession,
  destroySession,
  destroySessionCookie,
  getSessionUser,
} from '../auth/sessions';
import { rateLimit } from '../auth/rate-limit';
import { recordAudit } from '../services/audit';
import type { AppEnv } from '../types';

export const authRoutes = new Hono<AppEnv>();

function ipOf(c: { req: { header: (k: string) => string | undefined } }): string | null {
  return c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

function uaOf(c: { req: { header: (k: string) => string | undefined } }): string | null {
  return c.req.header('user-agent')?.slice(0, 300) ?? null;
}

authRoutes.get('/status', async (c) => {
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>();
  return c.json({ initialized: (row?.n ?? 0) > 0 });
});

authRoutes.post('/setup', async (c) => {
  const ip = ipOf(c);
  const rl = await rateLimit(c.env, `setup:${ip ?? 'anon'}`, 10, 3600);
  if (!rl.ok) return c.json({ error: 'Too many attempts. Try again later.' }, 429);

  const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>();
  if ((count?.n ?? 0) > 0) {
    return c.json({ error: 'This system is already set up. Sign in instead.' }, 409);
  }
  const parsed = setupSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid input', fields: zodFieldErrors(parsed) }, 400);
  const { name, email, password } = parsed.data;

  const exists = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (exists) return c.json({ error: 'That e-mail is already registered.' }, 409);

  const hash = await hashPassword(password);
  const res = await c.env.DB.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)')
    .bind(email, name, hash)
    .run();
  const userId = Number(res.meta.last_row_id ?? 0);

  const secure = cookieSecureFor(new URL(c.req.url), c.env);
  const session = await createSession(c.env, userId, ip, uaOf(c), secure);
  await recordAudit(c.env, email, 'account.setup', 'user', String(userId), { name }, ip);
  const headers: Record<string, string> = { 'Set-Cookie': session.cookie };
  const origin = c.req.header('origin');
  if (origin && isAllowedOrigin(origin, c.env)) Object.assign(headers, corsHeaders(origin));
  return c.json({ ok: true, user: { id: userId, name, email, role: 'admin' } }, 201, headers);
});

// A pre-computed dummy hash so failed logins take the same time as successful
// ones (defeats user-existence timing attacks).
const DUMMY_HASH =
  'pbkdf2-sha256$210000$' +
  'AAAAAAAAAAAAAAAAAAAAAA' +
  '$' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

authRoutes.post('/login', async (c) => {
  const ip = ipOf(c);
  const rl = await rateLimit(c.env, `login:${ip ?? 'anon'}`, 5, 60);
  if (!rl.ok) {
    return c.json({ error: 'Too many sign-in attempts. Wait a minute and try again.' }, 429, {
      'Retry-After': String(rl.retryAfterSec ?? 60),
    });
  }

  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid input', fields: zodFieldErrors(parsed) }, 400);
  const { email, password } = parsed.data;

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: number; email: string; name: string; password_hash: string }>();
  const ok = user
    ? await verifyPassword(password, user.password_hash)
    : await verifyPassword(password, DUMMY_HASH);
  if (!user || !ok) {
    return c.json({ error: 'Incorrect e-mail or password.' }, 401);
  }

  await c.env.DB.prepare(`UPDATE users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .bind(user.id)
    .run();
  const secure = cookieSecureFor(new URL(c.req.url), c.env);
  const session = await createSession(c.env, user.id, ip, uaOf(c), secure);
  await recordAudit(c.env, user.email, 'auth.login', 'user', String(user.id), null, ip);
  const headers: Record<string, string> = { 'Set-Cookie': session.cookie };
  const origin = c.req.header('origin');
  if (origin && isAllowedOrigin(origin, c.env)) Object.assign(headers, corsHeaders(origin));
  return c.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: 'admin' } }, 200, headers);
});

authRoutes.post('/logout', async (c) => {
  const cookie = c.req.header('cookie');
  await destroySession(c.env, cookie);
  const secure = cookieSecureFor(new URL(c.req.url), c.env);
  return c.json({ ok: true }, 200, { 'Set-Cookie': destroySessionCookie(secure) });
});

authRoutes.get('/me', async (c) => {
  const user = await getSessionUser(c.env, c.req.header('cookie'));
  if (!user) return c.json({ error: 'Not signed in' }, 401);
  return c.json({ user });
});

authRoutes.post('/password', async (c) => {
  const user = await getSessionUser(c.env, c.req.header('cookie'));
  if (!user) return c.json({ error: 'Not signed in' }, 401);
  const ip = ipOf(c);
  const parsed = passwordChangeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid input', fields: zodFieldErrors(parsed) }, 400);
  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(user.id)
    .first<{ password_hash: string }>();
  if (!row || !(await verifyPassword(parsed.data.current, row.password_hash))) {
    return c.json({ error: 'Current password is incorrect.' }, 400);
  }
  const hash = await hashPassword(parsed.data.next);
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, user.id).run();
  await recordAudit(c.env, user.email, 'password.change', 'user', String(user.id), null, ip);
  return c.json({ ok: true });
});

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  };
}

export { corsHeaders };
