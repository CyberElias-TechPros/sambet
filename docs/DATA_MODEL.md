# Data model

SQLite (Cloudflare D1). Canonical DDL: `worker/migrations/0001_init.sql` +
`worker/migrations/0002_import_approval.sql`. The worker also self-heals the same schema
at boot (`ensureSchema`, including the additive 0002 columns via `PRAGMA table_info`),
so a fresh or pre-existing database works without manual steps.

## Tables

### `users`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| email | TEXT UNIQUE (NOCASE) | login identifier |
| name | TEXT | display name |
| password_hash | TEXT | `pbkdf2-sha256$210000$<salt-b64url>$<hash-b64url>` |
| role | TEXT | `'admin'` or `'editor'` |
| created_at / last_login_at | TEXT | ISO-8601 UTC |
| disabled_at | TEXT, nullable | set when disabled — sessions for the user are deleted at the same time; login returns 403 |

The first admin is created by `auth/setup` (only possible while the table is empty).
Additional members are created in-app by an admin on the **Team** page
(`POST /api/users`, one-time temporary password) or out-of-band (insert a user row with
a properly generated hash). A user can be `editor` (staff: records + import submissions)
or `admin` (everything, incl. approving imports and managing the team). Self-protection
is enforced: you can't disable or demote yourself, and the last active admin can't be
disabled or demoted.

### `sessions`
| Column | Type | Notes |
|---|---|---|
| token_hash | TEXT PK | SHA-256 of the 32-byte bearer token (cookie value) |
| user_id | INTEGER → users.id | `ON DELETE CASCADE` |
| created_at / expires_at | TEXT | 30-day lifetime |
| last_ip / last_ua | TEXT | last-seen metadata |

### `organizations` (the registry)
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| sn | INTEGER UNIQUE, nullable | the original S/N from the legacy workbook |
| name | TEXT NOT NULL | immutable after creation (PATCH rejects changes) |
| ceo_name | TEXT | |
| phone | TEXT | normalized to E.164 `+234…` when possible |
| email | TEXT | validated on write |
| bank / bank_norm | TEXT / TEXT | raw as entered / canonical bank name (NULL if unrecognized) |
| account_number | TEXT | |
| lga / state / state_norm | TEXT / TEXT / TEXT | LGA as entered; state raw / canonical Nigerian state (NULL if unrecognized) |
| project_type | TEXT | raw free-text description as entered |
| project_category | TEXT NOT NULL | one of 13 canonical categories, defaulted to `'Other'` |
| status | TEXT NOT NULL | default `'registered'` (open vocabulary; UI offers registered / approved / rejected / pending) |
| notes | TEXT | |
| cycle | TEXT NOT NULL | default `'Project 1'` (project round/cohort) |
| source | TEXT NOT NULL | `'manual'` or `'import'` |
| source_import_id | INTEGER → imports.id | which import created it |
| created_at / updated_at | TEXT | |
| deleted_at | TEXT | **soft delete** — rows are never physically removed by the app; list/stats/exports all exclude soft-deleted rows |

Indexes: `name` (NOCASE), `state_norm`, `project_category`, `bank_norm`, `status`,
`cycle`, `updated_at DESC`, `phone`, and the duplicate-detection composite
`(replace(lower(trim(name)),' ',''), state_norm)`.

**Computed, not stored:** `is_duplicate` and `missing` (the list of empty critical
fields: name, phone, email, state, lga, bank, account, ceo, project). Both are derived
in SQL on read, so they can never drift from the data.

### `imports`
| Column | Notes |
|---|---|
| id PK | |
| filename | original upload name |
| r2_key | `imports/<id>/<safe-filename>` — archived original file (kept for completed **and** pending/rejected imports) |
| payload_key | `imports/<id>/payload.json` — parsed rows while `pending`; deleted on approve/reject |
| total_rows / created_count / updated_count / skipped_count / error_count | result counters |
| status | `pending` → `completed` \| `rejected` (review queue); direct admin imports go straight to `completed`; `failed` marks a mid-apply crash |
| report | JSON: row counts, first error/warning samples, strategy, approver |
| actor_email | who submitted/executed it |
| reviewed_by / reviewed_at | who approved or rejected, when |
| rejection_reason | admin's reason (or the auto `Expired — not reviewed within 7 days`) |
| created_at | |

### `audit_log`
Append-only. Actions: `account.setup`, `auth.login`, `password.change`,
`password.reset`, `org.create`, `org.update`, `org.delete`, `org.bulk_delete`,
`import.completed`, `import.submitted`, `import.approved`, `import.rejected`,
`user.created`, `user.updated`.
`details` is JSON with changed-field summaries (e.g. `{"changed":["state","phone"]}`)
— **no account numbers or third-party PII** in details (password resets log the target
e-mail, never the password).

### `rate_limits`
Fixed window: `key` (e.g. `login:<ip>`), `count`, `window_start` (unix seconds).
Pruned opportunistically on writes.

## Normalization rules (import + manual entry)

Applied in `worker/src/lib/normalize-org.ts` (shared by importer and CRUD):

- **States** — 91 observed variants mapped to the 37 canonical states + FCT via
  `STATE_ALIASES` (e.g. `RIVER STATE` → Rivers, `LAGOS MAINLAND` → Lagos,
  `FCT AMAC` → FCT, `zDelta` → Delta, `KWARA.` → Kwara). Unknown → `state_norm = NULL`
  (row still saved; surfaced as "missing/unknown state" in data-quality views).
- **Banks** — raw string → canonical bank name via `BANK_ALIASES`
  (e.g. `GTB`/`GUARANTY TRUST` → Guaranty Trust Bank). Unknown → `bank_norm = NULL`.
- **Categories** — 13 canonical categories. Inference from `project_type` keywords
  (e.g. *borehole* → Water, *solar* → Energy, *school* → Education); unmatched → `Other`.
- **Phones** — Nigerian formats (`0803…`, `+234 803…`, `234803…`, `(0803) …`) →
  `+234XXXXXXXXXX`; non-Nigerian/invalid → kept raw, flagged by validation.
- **Whitespace/case** — trimmed; inner spacing collapsed; `sn` kept as integer when numeric.

## Invariants the API enforces

1. `name` is required (create) and immutable (update).
2. `sn`, when given, is unique → 409 on collision.
3. Same-state exact duplicate (name+state dup key, or sn/name+phone/name+account) on
   create → **409** with the existing org id (import path: counted as duplicate and
   stored/updated per strategy instead).
4. Soft delete only: `DELETE /api/organizations/:id` sets `deleted_at`; the row is
   hidden from all reads. The `sn` UNIQUE index still holds the value of a soft-deleted
   row, so re-using a deleted S/N returns a clean **409** ("S/N … already in use by a
   (deleted) record") rather than a constraint crash. Physically purging a soft-deleted
   row (only ever needed to free an S/N) is a manual D1 operation.
5. Bulk delete ≤ 500 ids per call; missing ids silently ignored; result reports counts.
6. Import approval: an import row is `pending` until an admin `approve`s (→
   `completed`, rows applied with matching re-run against the current registry) or
   `reject`s it (→ `rejected`, nothing applied). Pending rows auto-expire after 7 days.
   A `pending`/`rejected`/`completed` row cannot be re-approved (409); the apply step is
   idempotent per import id.
7. Roles: `admin` and `editor`. Import execute/approve/reject and all `/api/users`
   routes are admin-only (403 for editors). A user cannot disable or demote
   themselves; the last active admin cannot be disabled or demoted.
