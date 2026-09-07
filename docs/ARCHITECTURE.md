# Architecture

Sambet Grassroots Project — member organization registry.

Two deployables, one database:

```
┌─────────────────────────────┐        ┌──────────────────────────────────────────┐
│  Vercel: sambet-web         │        │  Cloudflare: sambet-api (Worker)         │
│  Next.js 14 (App Router)    │  HTTPS │  Hono 4, Node.js compat                 │
│  React 18 + Tailwind CSS 3  │───────▶│                                          │
│                             │ /api/* │  ┌──────────┐   ┌────────────────────┐   │
│  Public: / /submit /track   │ (Vercel│  │  Auth    │   │ Organizations      │   │
│  Staff: /dashboard /orgs    │ rewrites,│ │ (sessions│   │ (CRUD, search,     │   │
│  /import /submissions /team │ server- │ │ in D1,   │   │ duplicate &        │   │
│  /audit /settings /login    │ side)   │ │ PBKDF2)  │   │ missing-field      │   │
│  /api → proxy → Worker      │        │  └──────────┘   │ detection)         │   │
│                             │        │  └──────────┘   │ detection)         │   │
│  Fonts self-hosted          │        │  ┌──────────┐   └────────────────────┘   │
│  (Inter + Fraunces via      │        │  │ Importer │   ┌────────────────────┐   │
│  @fontsource — no external  │        │  │ (xlsx/   │   │ Exporter (xlsx/csv)│   │
│  network at build time)     │        │  │ csv parse│   └────────────────────┘   │
│                             │        │  │ + validate│  ┌────────────────────┐   │
│  First-party cookie         │        │  │ + normalize)├▶│ Stats, audit log   │   │
│  sambet_session (HttpOnly)  │        │  └─────┬──────┘  └────────────────────┘   │
└─────────────────────────────┘        │        │            │                     │
                                       │        ▼            ▼                     │
                                       │  ┌──────────────────────────┐             │
                                       │  │ D1: sambet-db (SQLite)   │             │
                                       │  │ users, sessions,         │             │
                                       │  │ organizations, imports,  │             │
                                       │  │ submissions, audit_log,  │             │
                                       │  │ rate_limits              │             │
                                       │  └──────────────────────────┘             │
                                       │  ┌──────────────────────────┐             │
                                       │  │ R2: sambet-imports       │             │
                                       │  │ uploads/<id>.{json,file} │  (1 h TTL)  │
                                       │  │ imports/<id>/<filename>  │  (archive)  │
                                       │  │ submissions/<ref>/pop.*  │  (POP imgs) │
                                       │  └──────────────────────────┘             │
                                       └──────────────────────────────────────────┘
```

## Components

### `web/` — frontend (Vercel)

- **Next.js 14 App Router**, all UI is client-rendered over the JSON API (the app is a pure
  SPA-like shell; no server components needed beyond the root layout and the static
  landing page).
- **Two audiences, two route groups.** Public (no login): `/` (landing), `/submit`
  (self-registration + proof of payment), `/track` (reference lookup). Staff
  (session-guarded `(app)` group): `/dashboard`, `/organizations`, `/import`,
  `/submissions` (payment verification queue), `/team`, `/audit`, `/settings`.
- **Tailwind CSS** design system with custom tokens (see `web/tailwind.config.ts`):
  paper background `#F7F6F2`, "leaf" green primary, dark "bark" sidebar, Fraunces display
  font for headings, Inter for UI.
- **No chart library** — the charts (top-states horizontal bars, category donut,
  14-day submission trend) are small hand-rolled components
  (`web/src/components/charts/charts.tsx`), keeping the bundle at ~87–105 kB first load.
- **API proxy**: `web/next.config.mjs` rewrites `/api/:path*` to
  `NEXT_PUBLIC_API_PROXY_URL` (default `http://127.0.0.1:8787` in dev, the Cloudflare Worker
  URL in production). Because the proxy is same-origin, the session cookie is a normal
  first-party `HttpOnly` cookie — no CORS, no token juggling in JS.
- **Auth state**: `web/src/hooks/use-auth.tsx` fetches `/api/auth/status` + `/api/auth/me`
  on load; the `(app)` route group guards the staff pages and redirects to `/login`.
  Public pages (`/`, `/submit`, `/track`) live outside that group and need no session.

### `worker/` — backend (Cloudflare Worker)

- **Hono 4** with `nodejs_compat`. TypeScript strict mode.
- **D1 (SQLite)** for all durable data. Schema is idempotent (`CREATE ... IF NOT EXISTS`)
  and self-heals: the worker runs `ensureSchema()` once per isolate on the first `/api/*`
  request, so a fresh database needs zero manual steps. The canonical migrations
  (`worker/migrations/0001_init.sql`, `0002_import_approval.sql`,
  `0003_public_submissions.sql`) are what `wrangler d1 migrations apply` uses for
  production; `ensureSchema` also picks up the additive 0002 columns on pre-existing
  databases via `PRAGMA table_info` checks (and creates the 0003 `submissions` table),
  and all paths stay in sync.
- **R2** for file storage only:
  - `uploads/<uploadId>.json` / `.file` — parsed rows + original upload, kept 1 hour so a
    preview→execute round-trip can survive a browser tab close.
  - `imports/<importId>/payload.json` — parsed rows held while an import waits in the
    approval queue (no TTL; removed on approve/reject).
  - `imports/<importId>/<safe-filename>` — permanent audit archive of every import's
    original file.
  - `submissions/<reference>/pop.<ext>` — the proof-of-payment image for each public
    submission (kept permanently; served only via the authenticated
    `GET /api/submissions/:id/pop` endpoint, never a public URL).
- **No KV, Durable Objects, Queues, or Cron** — deliberately. Rate limiting is a tiny
  fixed-window table in D1 (`rate_limits`), and there is nothing async to queue. See
  [ADR-0001](adr/0001-workers-d1-r2-only.md).

## Request flow

### Login

```
POST /api/auth/login {email,password}
  → look up user by email (COLLATE NOCASE)
  → PBKDF2-SHA256, 210k iterations, per-user 16-byte salt (timing-safe compare)
  → create 32-byte session token; store sha256(token) in D1 `sessions`, 30-day expiry
  → Set-Cookie: sambet_session=<token>; HttpOnly; SameSite=Lax; Path=/
```

Login verification has a constant shape: unknown emails are checked against a dummy hash
before the 401, so user enumeration by timing is not possible. Login is rate-limited to
5 attempts / 60 s / IP; first-run setup to 10 / hour / IP.

### First-run setup

`/api/auth/setup` is only allowed while `users` is empty (checked inside the insert's
transaction; second attempts get 409). Password policy: ≥10 chars, ≥3 of
{lowercase, uppercase, digit, symbol}. This is how the very first admin is created —
there is no seed account and no recovery path by design (recovery = reset D1 rows,
documented in DEPLOYMENT.md).

### Import (two-phase, see ADR-0002)

```
1. POST /api/imports/preview   multipart: file (≤10 MB) + strategy (update|skip)
   → clip pathological sheet ranges, SheetJS parse, header mapping
   → per-row: normalize (states, banks, categories, phones → +234, dedupe spaces) +
     zod validation + in-batch and against-DB duplicate detection
   → store rows in R2 (1 h TTL), return {uploadId, total, create, update, skip,
     errors[], warnings[], unmappedHeaders[]}          (errors/warnings capped at 50)

2. POST /api/imports/execute   JSON: {uploadId, strategy}
   → re-read rows from R2, apply the chosen strategy
   → upsert in D1 batches of 100; per-row errors are collected, never abort the batch
   → archive original file to R2 `imports/<id>/…`, write `imports` row + audit entry
   → return {importId, created, updated, skipped, errors}
```

Execute is idempotent per uploadId (a second execute 410s), so a slow reviewer can retry
safely.

### Import approval (roles — see ADR-0003)

There are two roles: **admin** (data owner) and **editor** (staff). Both can upload a
workbook and see the preview report; only an admin may *apply* an import directly
(`/execute`). An editor instead calls:

```
POST /api/imports/submit  {uploadId, strategy}
  → moves the R2 payload from uploads/ (1h) into imports/<id>/ (permanent)
  → creates an imports row with status='pending'. NO records touched.
```

An admin then reviews on the Import page (full report + archived file) and:

```
POST /api/imports/:id/approve  {strategy}   (admin only)
  → re-runs duplicate matching against the CURRENT registry (rows may have changed
    since submission), then applies with the strategy chosen AT APPROVAL time
POST /api/imports/:id/reject   {reason}     (admin only)
  → status='rejected', reason stored and shown in history
```

Pending submissions expire after 7 days (lazy check on the approval attempt — no cron).
Every submit/approve/reject is audited. Team management (`/api/users`: list, create with
one-time temp password, role change, disable/re-enable, password reset) is admin-only,
with self-protection (you can't disable/demote yourself, and the last active admin can't
be locked out). Disabling a user deletes their sessions, so they're signed out
immediately.

### Public self-registration (proof of payment — see ADR-0004)

The public registers its own organizations; staff verify the payment.

```
POST /api/public/submit   multipart (no auth; 8/hour/IP + honeypot)
  → org name, phone, state, bank+account paid FROM, amount (₦), optional
    payment date / reference / message + a POP image (jpg/png/webp ≤ 6 MB)
  → zod validation; phone normalized to +234; image stored in R2
    submissions/<reference>/pop.<ext>
  → duplicate match against the registry (phone > account > name+state)
  → 201 {reference: "SAM-2026-00001", status: "pending", matches[]}

GET /api/public/status/:reference   (no auth — coarse status only)
  → pending | verified (+org name) | rejected (+reason); 404 if unknown
```

Staff then work the queue (`/api/submissions*`, session required):

```
GET /api/submissions?status=&q=&page=     list + tab summary
GET /api/submissions/:id                  detail + matches + POP url
GET /api/submissions/stats                counts, naira totals, 14-day trend, top states
POST /api/submissions/:id/verify  (admin) {action:'create', org} | {action:'link', orgId}
  → create: org added with source='public'; a hard 409 fires if the phone or
    account already exists (forces a link decision)
  → link: the payment is attached to an existing org (e.g. a top-up)
POST /api/submissions/:id/reject  (admin) {reason}   → reason shown via /track
GET /api/submissions/:id/pop      (staff)  streams the POP image (session only)
```

A submission can be reviewed exactly once (second review → 409); every step is
audited. The claimed naira feeds the dashboard band (pending / verified / 30-day
collected, excluding rejected).

### Duplicate detection

Order of matching (most specific first), scoped to non-deleted rows:

1. same `sn`
2. same normalized name + phone
3. same normalized name + account number
4. same normalized name + state (unique match only — ambiguous names don't flag)

`normalized name` = lowercased, trimmed, spaces removed. Rows matching any existing org
are stored as usual but carry a computed `is_duplicate` (exposed in SQL via the
`idx_org_dup` index: `replace(lower(trim(name)),' ','')` + `state_norm`), and the
organizations list can be filtered to just those.

### Editing (PATCH semantics)

`PATCH /api/organizations/:id` is a **true partial update**: only the fields present in
the request body are changed (an explicit `null` clears a field); omitted fields keep
their current values — a status-only edit can never blank other data. The name is
immutable (renames are rejected with 400; an unchanged echoed name is tolerated so the
edit form can submit the whole object). Derived columns re-normalize with their source:
editing `bank` recomputes `bank_norm`, editing `state` recomputes `state_norm`, and
editing `project_type` re-infers `project_category` (the category is always derived from
the project description — to correct a category, correct the description). The response
reports the `changed` list (used by the audit log).

### Export

`GET /api/organizations/export?format=xlsx|csv` accepts the same filter query params as
the list endpoint and streams the filtered set (capped at 20,000 rows) in S/N order.
`GET /api/organizations/template` returns a blank import template. Both are file
downloads; the frontend opens them via a short-lived signed URL helper (`api.exportUrl`).

## Security summary

| Concern | Handling |
|---|---|
| Passwords | PBKDF2-SHA256, 210,000 iterations, 16 B random salt per user |
| Sessions | 32 B random token, only its SHA-256 stored; 30-day expiry; `HttpOnly` `SameSite=Lax` cookie; `Secure` flag when the request is HTTPS |
| Authz | Every `/api/*` route requires a valid session except `health`, `auth/status`, `auth/setup`, `auth/login` and the two public endpoints (`public/submit`, `public/status/:ref` — by design, they carry no session). Import execution/approval/rejection, all `/api/users` routes, and submission verify/reject additionally require `role='admin'` (403 otherwise) |
| Brute force | Fixed-window rate limits in D1: login 5/60 s, setup 10/h, import preview 30/h, public submissions 8/h per IP (fail-open on DB error) |
| Proof-of-payment images | POP images are personal data (bank details). They live in R2 and are streamed only through the session-checked `GET /api/submissions/:id/pop` — never a public/signed URL. The public status endpoint returns only coarse status, never the image or payment fields |
| User enumeration | Constant-timing login; no user-count leaking from `auth/status` |
| Input | zod validation on all write endpoints; SQL is parameterized everywhere; HTML is React-escaped in the UI |
| File uploads | 10 MB cap; only `.xlsx`/`.csv` (by extension, then parse-attempt); original stored in R2 (not served back) |
| CORS | Only allowed when `Origin` matches `FRONTEND_ORIGIN` (or a dev origin in local mode). Not needed for the primary flow, which is same-origin via the Vercel rewrite |
| PII | Bank account numbers are stored (business requirement) but never logged; audit `details` excludes account numbers/emails of other parties |
| Temp passwords | Team-member temp passwords are CSPRNG-generated (all 4 char classes) and returned exactly once; never persisted beyond the PBKDF2 hash |

## Performance notes

- Organization list is a single indexed query (search uses a `WHERE ... LIKE` over
  `name`/`ceo_name`/`sn` — adequate at 2k rows; the `idx_org_*` indexes cover all
  filter/sort combinations the UI exposes).
- Stats (`GET /api/stats`) is ~8 small aggregate queries, all indexed; the page loads
  them in one parallel batch.
- The legacy workbook's pathological sheet range (see `clipSheetRange` in
  `worker/src/services/importer.ts`) is clipped before parsing: parsing dropped from
  ~20 s / ~1 GB to ~0.5 s / ~160 MB.
- Worker memory ceiling: D1 batch inserts of 100 rows keep request memory flat for
  thousands of rows.

## Testing

- `worker/`: 105 unit tests (normalization, importer, validation, temp-password policy,
  approval-expiry, **public-submission validation + reference/trend helpers**) — `npm
  test` (Vitest, no network).
- `worker/scripts/integration-test.mjs`: 158 end-to-end assertions against a real local
  `workerd` (fresh state) — auth lifecycle, first-run setup, real-file import, filters,
  CRUD, duplicate 409s, import preview/execute/retry, export, audit, **team roles +
  import approval queue** (editor submits → admin approves/rejects, permission 403s,
  disable/enable + session invalidation), rate limiting, and **public self-registration +
  payment verification** (submit + reference, duplicate matches, POP upload/download +
  401, verify-create/link, taken-phone 409, reject + reason, stats/naira/trend, public
  status non-leakage, 8/hour submission limit). `npm run test:integration`.
- `web/`: `npm run typecheck` and `npm run build` (production build is clean; routes are
  static, ~87–105 kB first load).
