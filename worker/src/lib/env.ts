export interface SambetEnv {
  DB: D1Database;
  FILES: R2Bucket;
  /** Allowed browser origin for CORS (e.g. https://sambet.vercel.app). */
  FRONTEND_ORIGIN?: string;
  /**
   * "true"/"false" force the Secure cookie attribute; default is
   * auto (Secure for https requests, not for plain-http local dev).
   */
  COOKIE_SECURE?: string;
}

export type Bindings = SambetEnv;

const DEV_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

/** True when `origin` (from an Origin header) may make credentialed calls. */
export function isAllowedOrigin(origin: string | undefined | null, env: SambetEnv): boolean {
  if (!origin) return false;
  if (DEV_ORIGINS.has(origin)) return true;
  return !!env.FRONTEND_ORIGIN && env.FRONTEND_ORIGIN.replace(/\/$/, '') === origin.replace(/\/$/, '');
}

export function cookieSecureFor(url: URL, env: SambetEnv): boolean {
  if (env.COOKIE_SECURE === 'true') return true;
  if (env.COOKIE_SECURE === 'false') return false;
  return url.protocol === 'https:';
}
