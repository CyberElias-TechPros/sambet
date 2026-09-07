# Data model

SQLite (Cloudflare D1). Canonical DDL: `worker/migrations/0001_init.sql`.
The worker also self-heals the same schema at boot (`ensureSchema`), so a fresh database
works without manual steps.

## Tables

### `users`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| email | TEXT UNIQUE (NOCASE) | login identifier |
| name | TEXT | display name |
| password_hash | TEXT | `pbkdf2$sha256$210000$<salt b64>$<hash b64>` |
| role | TEXT | `'admin'` (single role for now) |
| created_at / last_login_at | TEXT | ISO-8601 UTC |

Exactly one admin exists in practice: `auth/setup` is only possible while the table is
empty; additional accounts are created by an admin out-of-band (insert a user row with a
properly generated hash — there is no in-app "invite" flow, deliberately, to keep the
trust model simple for a small staff team).

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
| r2_key | `imports/<id>/<safe-filename>` audit archive |
| total_rows / created_count / updated_count / skipped_count / error_count | result counters |
| status | `'completed'` (failed executions are not recorded — the preview/execute contract means partial success is always "completed with N errors") |
| report | JSON: first error/warning samples + normalization stats |
| actor_email | who executed it |
| created_at | |

### `audit_log`
Append-only. Actions: `account.setup`, `auth.login`, `password.change`,
`org.create`, `org.update`, `org.delete`, `org.bulk_delete`, `import.completed`.
`details` is JSON with changed-field summaries (e.g. `{"changed":["state","phone"]}`)
— **no account numbers or third-party PII** in details.

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
