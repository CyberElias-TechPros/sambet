import { Hono, type MiddlewareHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Bindings } from './lib/env';
import { isAllowedOrigin } from './lib/env';
import { getSessionUser } from './auth/sessions';
import { rateLimit } from './auth/rate-limit';
import { authRoutes, corsHeaders } from './routes/auth';
import { orgRoutes } from './routes/organizations';
import { statsRoutes } from './routes/stats';
import { importRoutes } from './routes/imports';
import { userRoutes } from './routes/users';
import { publicRoutes } from './routes/public';
import { submissionRoutes } from './routes/submissions';
import { ensureSchema } from './schema';
import type { AppEnv } from './types';

const app = new Hono<AppEnv>();

// Self-healing schema: a brand-new D1 becomes usable on the first request
// (no separate CLI bootstrap needed for dev or first production deploy).
app.use('/api/*', async (c, next) => {
  await ensureSchema(c.env.DB);
  await next();
});

/* ------------------------- CORS + base headers -------------------------
 * Recommended production setup: Vercel proxies /api/* to this Worker, so the
 * browser only ever sees one origin (no CORS). We also allow credentialed
 * cross-origin calls from FRONTEND_ORIGIN for direct API access.
 */
app.use('/api/*', async (c, next) => {
  const origin = c.req.header('origin');
  if (origin && isAllowedOrigin(origin, c.env)) {
    if (c.req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
    for (const [k, v] of Object.entries(corsHeaders(origin))) c.header(k, v);
  }
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  await next();
});

/* ------------------------- auth guard ------------------------- */
const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await getSessionUser(c.env, c.req.header('cookie') ?? undefined);
  if (!user) return c.json({ error: 'Not signed in' }, 401);
  const ip =
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';
  c.set('user', user);
  c.set('ip', ip);
  await next();
};

/* ------------------------- public ------------------------- */
app.get('/api/health', (c) => c.json({ ok: true, service: 'sambet-api', time: new Date().toISOString() }));
app.route('/api/auth', authRoutes);

// Public self-registration (proof-of-payment submission). No auth; throttled
// per IP because the POP image upload is comparatively heavy.
app.use('/api/public/submit', async (c, next) => {
  const ip =
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';
  const rl = await rateLimit(c.env, `pubsub:${ip}`, 8, 3600);
  if (!rl.ok) return c.json({ error: 'Too many submissions from your connection right now. Please try again later.' }, 429);
  await next();
});
app.route('/api/public', publicRoutes);

/* ------------------------- authenticated ------------------------- */
app.use('/api/organizations', requireAuth);
app.use('/api/organizations/*', requireAuth);
app.use('/api/stats', requireAuth);
app.use('/api/stats/*', requireAuth);
app.use('/api/imports', requireAuth);
app.use('/api/imports/*', requireAuth);
app.use('/api/users', requireAuth);
app.use('/api/users/*', requireAuth);
app.use('/api/submissions', requireAuth);
app.use('/api/submissions/*', requireAuth);

// Extra throttle for import previews (file parsing is comparatively heavy).
app.use('/api/imports/preview', async (c, next) => {
  const ip =
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';
  const rl = await rateLimit(c.env, `import:${ip}`, 30, 3600);
  if (!rl.ok) return c.json({ error: 'Too many imports right now. Try again later.' }, 429);
  await next();
});

app.route('/api/organizations', orgRoutes);
app.route('/api/stats', statsRoutes);
app.route('/api/imports', importRoutes);
app.route('/api/users', userRoutes);
app.route('/api/submissions', submissionRoutes);

/* ------------------------- 404 + errors ------------------------- */
app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error(`[error] ${c.req.method} ${new URL(c.req.url).pathname}`, err);
  const status = (err as { status?: number }).status;
  if (status && status >= 400 && status < 600) {
    return c.json({ error: err.message || 'Request failed' }, status as ContentfulStatusCode);
  }
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
