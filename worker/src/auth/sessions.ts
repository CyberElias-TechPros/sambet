import type { Bindings } from '../lib/env';

export const SESSION_COOKIE = 'sambet_session';
const SESSION_DAYS = 30;

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(
  env: Bindings,
  userId: number,
  ip: string | null,
  ua: string | null,
  secure: boolean,
): Promise<{ token: string; cookie: string; secure: boolean }> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const hash = await sha256Hex(token);
  const now = Date.now();
  const created = new Date(now).toISOString();
  const expires = new Date(now + SESSION_DAYS * 86400_000).toISOString();
  await env.DB.prepare(
    `INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_ip, last_ua)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(hash, userId, created, expires, ip ?? null, ua ?? null)
    .run();
  const cookie = `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`;
  return { token, cookie, secure };
}

export function destroySessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

/** Resolve the session cookie to a user, or null. */
export async function getSessionUser(env: Bindings, cookieHeader: string | undefined): Promise<SessionUser | null> {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((s) => s.trim());
  let token: string | null = null;
  for (const p of parts) {
    if (p.startsWith(`${SESSION_COOKIE}=`)) {
      token = p.slice(SESSION_COOKIE.length + 1);
      break;
    }
  }
  if (!token) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.disabled_at, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?`,
  )
    .bind(hash)
    .first<{ id: number; email: string; name: string; role: string; disabled_at: string | null; expires_at: string }>();
  if (!row) return null;
  if (row.disabled_at != null) {
    // Disabled accounts lose access immediately (no waiting for expiry).
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run();
    return null;
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run();
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export async function destroySession(env: Bindings, cookieHeader: string | undefined): Promise<void> {
  if (!cookieHeader) return;
  let token: string | null = null;
  for (const p of cookieHeader.split(';').map((s) => s.trim())) {
    if (p.startsWith(`${SESSION_COOKIE}=`)) {
      token = p.slice(SESSION_COOKIE.length + 1);
      break;
    }
  }
  if (!token) return;
  const hash = await sha256Hex(token);
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run();
}
