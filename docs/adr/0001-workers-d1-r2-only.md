# ADR-0001: Cloudflare Workers + D1 + R2 only — no KV, DO, Queues, Cron

**Status:** accepted (2026-09)

## Context

The project brief mandates the Cloudflare backend and says: *use CF services only where
actually needed — don't use everything*. The workload is a small, mostly-read registry
(~2k rows, <50 concurrent staff, occasional 1–5k-row imports) behind a Vercel frontend.

## Decision

Use exactly three Cloudflare services:

- **Workers** (Hono + `nodejs_compat`) — the entire API.
- **D1** — all durable state: users, sessions, organizations, imports, audit log, rate limits.
- **R2** — file storage only: transient import payloads (1 h TTL) and the permanent
  archive of executed import files.

Explicitly **not** used:

| Service | Why not |
|---|---|
| KV | Nothing here is cache-shaped; D1 reads are sub-millisecond at this scale |
| Durable Objects | No per-entity realtime/sync need; no websockets |
| Queues | Import runs synchronously in-request (worst case ~5k rows ≈ 50 D1 batches, well inside the 30 s request budget — measured ~1 s for 1,669 rows); a queue would add infra for no benefit |
| Cron Triggers | No scheduled jobs exist (no expiry sweep needed — sessions are validated on read) |

## Consequences

- Rate limiting lives in a D1 `rate_limits` table (fixed window, one `INSERT … ON
  CONFLICT` per protected request). At this traffic it is simpler and fully auditable;
  if it ever becomes hot, KV is the drop-in replacement (same interface in `rate-limit.ts`).
- A failed D1 call during rate-limit bookkeeping **fails open** (request allowed) — a
  denied import preview is recoverable, a locked-out staff member is not.
- Everything the app persists is in one database: one backup command, one restore.
