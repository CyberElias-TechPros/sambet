import type { Context } from 'hono';
import type { Bindings } from './lib/env';
import type { SessionUser } from './auth/sessions';

/** Environment shared by every route on the authenticated API. */
export type AppEnv = {
  Bindings: Bindings;
  Variables: { user?: SessionUser; ip?: string };
};

/** Authenticated actor (the requireAuth guard guarantees presence). */
export function userOf(c: Context<AppEnv>): { user: SessionUser; ip: string } {
  const user = c.get('user');
  if (!user) throw new Error('Authentication middleware did not run');
  return { user, ip: c.get('ip') ?? 'unknown' };
}
