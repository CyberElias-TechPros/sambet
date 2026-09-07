# Sambet Grassroots Project — Member Organization Registry

A record-management system for the **Sambet Grassroots Project** registry of member
organizations (MPCSLs / enterprises) applying for grassroots projects — roads, boreholes,
solar lighting, schools, housing, agriculture and more — across Nigeria.

It replaces a manually maintained spreadsheet (2,000 rows) with a secure, searchable,
data-quality-aware web app: browse and edit records, bulk-import and export **xlsx/csv**,
see duplicates and missing fields at a glance, and keep a full audit trail.

- **Frontend** — Next.js 14 + React 18 + Tailwind, deployed on **Vercel**
- **Backend** — Cloudflare **Worker** (Hono) + **D1** (SQLite) + **R2** (files)
- **Data** — the existing `SAMBET GRASSROOT PROJECT 1.xlsx` migrates in one import
  (1,669 valid records; 331 S/N-only blank rows are skipped automatically)

```
sambet/
├── web/                 # Next.js frontend (deploy to Vercel)
│   └── src/
│       ├── app/         # /login, /dashboard, /organizations, /import, /team, /audit, /settings
│       ├── components/  # design system (ui/), charts/, layout/, orgs/
│       ├── hooks/       # use-auth, use-toast
│       └── lib/         # api client, types, formatting, constants
├── worker/              # Cloudflare Worker API (deploy with wrangler)
│   ├── src/
│   │   ├── routes/      # /api/auth, /api/organizations, /api/imports, /api/stats
│   │   ├── services/    # organizations, importer, exporter, stats, audit
│   │   ├── lib/         # normalization (states/banks/categories/phones), validation
│   │   ├── auth/        # PBKDF2 passwords, sessions, rate limiting
│   │   └── schema.ts    # self-healing D1 schema
│   ├── migrations/      # canonical DDL (0001_init.sql, 0002_import_approval.sql)
│   └── scripts/         # integration test (real workerd + the real xlsx)
├── docs/                # ARCHITECTURE, DATA_MODEL, DEPLOYMENT, adr/
└── SAMBET GRASSROOT PROJECT 1.xlsx   # the legacy registry (migration source)
```

## Features

- **Registry** — search, filter (state / category / bank / status / cycle / incomplete /
  duplicates), sort, paginate; detail view with every field, copy-to-clipboard, related
  duplicates, and per-record missing-field list.
- **Add / edit / delete** — client + server validation, field-level errors, soft deletes
  (nothing is ever physically destroyed), bulk delete.
- **Bulk import (xlsx/csv)** — two-phase: *preview* (row-by-row validation report,
  duplicate matches, unmapped-column warnings) then apply. Admins apply directly;
  **staff submit for approval** and an admin reviews the full report + file and
  approves or rejects (with a reason) before anything is written. Import history,
  7-day expiry, and the original file archived to R2. A downloadable template keeps
  future cycles consistent.
- **Team & roles** — admin (full control, approves imports) vs. staff editor (maintains
  records, submits imports for review). In-app member management: add with a one-time
  temp password, change role, disable/re-enable (instant sign-out), reset password.
- **Bulk export (xlsx/csv)** — honors the active filters; standardized columns included.
- **Dashboard** — totals, state & category charts, status breakdown, most-missing fields,
  recently updated records, recent imports.
- **Data quality** — normalized Nigerian states (37 + FCT, 91+ known spellings), canonical
  banks, 13 project categories inferred from the description, E.164 phones; duplicate
  detection (S/N, name+phone, name+account, name+state); missing-field analytics.
- **Staff accounts** — first-run admin setup (no seed credentials), PBKDF2 password
  hashing, 30-day HttpOnly sessions, rate-limited login, change password, full audit log.

## Quick start (local)

```bash
# 1. API — Cloudflare Worker with local D1 + R2 (http://127.0.0.1:8787)
cd worker
npm install
npm run dev          # first request self-creates the schema; no setup needed

# 2. Frontend — Next.js (http://localhost:3000, proxies /api → :8787)
cd ../web
npm install
npm run dev
```

Open **http://localhost:3000** → *Set up your admin account* → log in →
**Import** your `SAMBET GRASSROOT PROJECT 1.xlsx` → review (1,669 rows, 0 errors) →
**Import**. The dashboard, registry, duplicates and audit log light up immediately.

### Tests

```bash
cd worker
npm test               # 85 unit tests (normalization, importer, validation)
npm run test:integration   # 80 end-to-end checks against a real local workerd,
                           # seeding the real legacy workbook through the API
cd ../web
npm run typecheck && npm run build
```

## Deploying

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for the exact steps (~15 min):
create D1 + R2 on Cloudflare, `wrangler deploy`, import the repo into Vercel
(root dir `web`, one env var pointing at the Worker URL), then create the admin
account and import the spreadsheet. No seed data, no secret files — the first-run
setup flow is the onboarding.

## Documentation

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — components, request flows, security & performance notes
- **[docs/DATA_MODEL.md](docs/DATA_MODEL.md)** — tables, normalization rules, invariants
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — Vercel + Cloudflare deploy, backups, rollback
- **[docs/adr/](docs/adr/)** — key decisions (Workers+D1+R2-only; two-phase import; role-based import approval)
