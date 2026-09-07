import type { Bindings } from '../lib/env';

/**
 * Tiny fixed-window rate limiter backed by D1.
 * Good enough for login brute-force protection and import abuse limits —
 * exactness under concurrency is not a requirement here.
 */
export async function rateLimit(
  env: Bindings,
  key: string,
  max: number,
  windowSec: number,
): Promise<{ ok: boolean; retryAfterSec?: number }> {
  const now = Math.floor(Date.now() / 1000);
  try {
    const row = await env.DB.prepare('SELECT count, window_start FROM rate_limits WHERE key = ?')
      .bind(key)
      .first<{ count: number; window_start: number }>();
    if (!row || now - row.window_start >= windowSec) {
      await env.DB.prepare(
        `INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start`,
      )
        .bind(key, now)
        .run();
      return { ok: true };
    }
    if (row.count >= max) {
      return { ok: false, retryAfterSec: windowSec - (now - row.window_start) };
    }
    await env.DB.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').bind(key).run();
    return { ok: true };
  } catch {
    // Never block traffic because the limiter itself failed.
    return { ok: true };
  }
}
