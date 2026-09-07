# Deployment

Two independent deployments: **Cloudflare** (API + D1 + R2) and **Vercel** (frontend).
The frontend talks to the API only through its own `/api` rewrite, so the browser never
sees the Cloudflare domain and no CORS is required.

Estimated time: ~15 minutes. No paid plan is required for the API (Workers free tier
covers D1 + R2 at this scale; R2 has no egress fees anyway).

---

## 1. Cloudflare — API, D1, R2

### 1.1 Create the D1 database

```bash
# from worker/
npx wrangler d1 create sambet-db
```

Copy the printed `database_id` (a UUID) and paste it into
`worker/wrangler.jsonc` → `d1_databases[0].database_id` (replacing the placeholder
`00000000-0000-0000-8000-000000000001`).

### 1.2 Create the R2 bucket

```bash
npx wrangler r2 bucket create sambet-imports
```

The binding name (`FILES`) and bucket name (`sambet-imports`) already match
`worker/wrangler.jsonc`.

### 1.3 Apply the schema

```bash
npx wrangler d1 migrations apply sambet-db --remote
```

This runs `worker/migrations/0001_init.sql`, `0002_import_approval.sql` (the
import-approval columns + roles) and `0003_public_submissions.sql` (the public
self-registration queue). (The worker also self-heals the schema on its first request,
so skipping this step won't break anything — but run it anyway; it's the canonical,
reviewable path.)

### 1.4 Deploy the Worker

```bash
npx wrangler deploy
```

Then set one secret-free variable (edit in the dashboard under
**Workers & Pages → sambet-api → Settings → Variables and Secrets**):

| Variable | Value |
|---|---|
| `FRONTEND_ORIGIN` | `https://<your-vercel-domain>` (step 3) |

`FRONTEND_ORIGIN` is only used for CORS on **direct** API calls (e.g. debugging with
Postman). The app itself is same-origin via the Vercel rewrite.

**Your API is live at** `https://sambet-api.<your-subdomain>.workers.dev`

Sanity check: `curl https://sambet-api.<your-subdomain>.workers.dev/api/health`

> **Production note:** the `Secure` cookie flag is applied automatically when the
> request arrives over HTTPS, which is the case for all production traffic.

---

## 2. Vercel — frontend

### 2.1 Push the repository

Push this repo to GitHub (or import it into Vercel directly). The frontend lives in
`web/` — point Vercel at that subdirectory.

### 2.2 Import in Vercel

1. **Vercel → Add New → Project** → import the repo.
2. Framework preset: **Next.js**.
3. **Root Directory**: `web`
4. Build command / output: defaults are correct (`next build`, `.next`).
5. Add one **Environment Variable** (set for Production, Preview, Development):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_PROXY_URL` | `https://sambet-api.<your-subdomain>.workers.dev` |

(`web/next.config.mjs` rewrites `/api/*` to this URL server-side at request time.)

6. Deploy.

### 2.3 First run

Open your Vercel URL. There is **no seed account** — the first visitor sees
*“Set up your admin account”*. Create the admin (name, work e-mail, strong password ≥10
chars with 3 of {lowercase, uppercase, digit, symbol}). The first-run setup endpoint is
then permanently closed (409).

Add staff from the **Team** page (admin only): *Add member* → name, e-mail, role
(Admin / Staff editor) → a temporary password is generated and shown **once**. The
member signs in with it and changes it in Settings. Team members can also be
disabled/re-enabled and have their password reset from the same page (disabling signs
them out immediately). If you ever need an account out-of-band, insert a `users` row
directly in D1 with a properly hashed password — do **not** wipe `users` to re-run
setup, since sessions cascade-delete with their user and everyone would be logged out.

### 2.4 Set the public payment account

The public pays the registration fee by bank transfer and submits the proof of payment
on `/submit`. Put the receiving account in
`web/src/lib/constants.ts` → `PUBLIC_TRANSFER` (`bank`, `accountName`,
`accountNumber`) and redeploy — the public page shows these details; while the account
number is empty it shows a "details being finalised" notice instead. The fee presets
(₦1,000 / ₦1,500 / ₦500) are in the same file (`FEE_OPTIONS`) — adjust if the program's
fees change.

### 2.5 Migrate the existing registry

In the deployed app: **Import → choose `SAMBET GRASSROOT PROJECT 1.xlsx` → Review →
Import**. The preview will show **1,669 rows / 0 errors / N duplicates** (the workbook's
2,000 rows include 331 S/N-only blank rows that are skipped by design). Choose the
**Update** strategy (first import → all created) and confirm.

After that, share the **public registration URL** (`https://<your-vercel-domain>/submit`
— also linked from the landing page and the staff sidebar) with the organizations.
Submissions appear in **Submissions** (staff) with a live pending badge in the sidebar;
an admin verifies each one (payment + POP) and either adds the organization to the
registry or links the payment to an existing record. The dashboard shows live
submissions stats and naira collected.

---

## 3. Local development (mirrors production)

```bash
# terminal 1 — API on :8787
cd worker && npm install && npm run dev

# terminal 2 — frontend on :3000 (proxies /api → :8787 automatically)
cd web && npm install && npm run dev
```

Open http://localhost:3000 — same first-run flow as production. Local D1/R2 live in
`worker/.wrangler/state` (delete the folder to reset).

## 4. Backups & recovery

- **D1 export** (regular, e.g. weekly): `npx wrangler d1 export sambet-db --remote --output sambet-backup-<date>.sql`
- **Restore**: create/recreate the DB, `npx wrangler d1 execute sambet-db --remote --file sambet-backup-<date>.sql`
- **R2 archive** of every executed import remains in the bucket (`imports/<id>/…`) — a
  second safety net for the source files.
- **Forgot the admin password?** Reset by updating the `password_hash` of the user row
  (format: `pbkdf2-sha256$210000$<salt-b64url>$<hash-b64url>`, PBKDF2-SHA256 with
  210,000 iterations and a random 16-byte salt), or wipe `users` + `sessions` and use
  first-run setup again.
- **Wrong data imported?** Imports are additive/updated by duplicate key — re-import the
  corrected file with the **Update** strategy to fix rows, or delete specific records in
  the UI. Soft-deleted rows are never destroyed, so a wrong bulk delete can be undone
  with `UPDATE organizations SET deleted_at = NULL WHERE …` in D1.

## 5. Rollback

Both platforms keep previous deployments:
- Vercel: **Deployments → <previous> → Promote to Production** (frontend only, instant).
- Cloudflare: Workers dashboard → **sambet-api → Versions → Rollback**.
The schema is additive-only (`IF NOT EXISTS`, new nullable columns), so a newer Worker
and older frontend (or vice versa) coexist safely across a rollback.

## 6. Cost notes (typical small usage)

| Item | Free tier | Cost at this scale (~2k rows, <50 users) |
|---|---|---|
| Workers requests | 100k/day | $0 |
| D1 | 5M row reads/day, 100k writes, 5 GB | $0 |
| R2 | 10 GB stored, 1M reads, 1M writes, **$0 egress** | $0 |
| Vercel Hobby | 100 GB bandwidth | $0 |
