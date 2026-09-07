import type { D1Database } from '@cloudflare/workers-types';

/**
 * Idempotent schema bootstrap, run once per isolate on first request.
 *
 * The authoritative schema lives in migrations/0001_init.sql (applied with
 * `wrangler d1 migrations apply` for remote databases). This module lets a
 * brand-new local or remote database become usable on the very first request,
 * without the operator having to remember a one-off CLI step. Every statement
 * is IF NOT EXISTS, so it is a no-op once the schema is present.
 *
 * Keep in sync with migrations/0001_init.sql.
 */
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'admin',
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    last_login_at TEXT,
    disabled_at   TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash    TEXT PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    expires_at    TEXT NOT NULL,
    last_ip       TEXT,
    last_ua       TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`,
  `CREATE TABLE IF NOT EXISTS organizations (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    sn               INTEGER UNIQUE,
    name             TEXT NOT NULL,
    ceo_name         TEXT,
    phone            TEXT,
    email            TEXT,
    bank             TEXT,
    bank_norm        TEXT,
    account_number   TEXT,
    lga              TEXT,
    state            TEXT,
    state_norm       TEXT,
    project_type     TEXT,
    project_category TEXT NOT NULL DEFAULT 'Other',
    status           TEXT NOT NULL DEFAULT 'registered',
    notes            TEXT,
    cycle            TEXT NOT NULL DEFAULT 'Project 1',
    source           TEXT NOT NULL DEFAULT 'manual',
    source_import_id INTEGER,
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    deleted_at       TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_org_name ON organizations(name COLLATE NOCASE)`,
  `CREATE INDEX IF NOT EXISTS idx_org_state ON organizations(state_norm)`,
  `CREATE INDEX IF NOT EXISTS idx_org_category ON organizations(project_category)`,
  `CREATE INDEX IF NOT EXISTS idx_org_bank ON organizations(bank_norm)`,
  `CREATE INDEX IF NOT EXISTS idx_org_status ON organizations(status)`,
  `CREATE INDEX IF NOT EXISTS idx_org_cycle ON organizations(cycle)`,
  `CREATE INDEX IF NOT EXISTS idx_org_updated ON organizations(updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_org_phone ON organizations(phone)`,
  `CREATE INDEX IF NOT EXISTS idx_org_dup ON organizations(replace(lower(trim(name)), ' ', ''), state_norm)`,
  `CREATE TABLE IF NOT EXISTS imports (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    filename        TEXT NOT NULL,
    r2_key          TEXT,
    total_rows      INTEGER NOT NULL DEFAULT 0,
    created_count   INTEGER NOT NULL DEFAULT 0,
    updated_count   INTEGER NOT NULL DEFAULT 0,
    skipped_count   INTEGER NOT NULL DEFAULT 0,
    error_count     INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'completed',
    report          TEXT,
    actor_email     TEXT,
    payload_key     TEXT,
    reviewed_by     TEXT,
    reviewed_at     TEXT,
    rejection_reason TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_imports_status ON imports(status)`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_email TEXT,
    action      TEXT NOT NULL,
    entity      TEXT NOT NULL,
    entity_id   TEXT,
    details     TEXT,
    ip          TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
    key          TEXT PRIMARY KEY,
    count        INTEGER NOT NULL DEFAULT 1,
    window_start INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS submissions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    reference         TEXT NOT NULL UNIQUE,
    org_name          TEXT NOT NULL,
    phone             TEXT NOT NULL,
    state             TEXT,
    bank              TEXT NOT NULL,
    account_number    TEXT NOT NULL,
    account_name      TEXT,
    amount_paid       INTEGER NOT NULL DEFAULT 1000,
    payment_date      TEXT,
    payment_reference TEXT,
    notes             TEXT,
    pop_key           TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'pending',
    org_id            INTEGER REFERENCES organizations(id),
    reviewed_by       INTEGER REFERENCES users(id),
    reviewed_at       TEXT,
    rejection_reason  TEXT,
    created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status)`,
  `CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_submissions_phone ON submissions(phone)`,
  `CREATE INDEX IF NOT EXISTS idx_submissions_account ON submissions(account_number)`,
];

/** (table, column, type) additions from migration 0002, for databases
 *  created before the import-approval feature existed. */
const COLUMN_UPGRADES: [string, string, string][] = [
  ['users', 'disabled_at', 'TEXT'],
  ['imports', 'payload_key', 'TEXT'],
  ['imports', 'reviewed_by', 'TEXT'],
  ['imports', 'reviewed_at', 'TEXT'],
  ['imports', 'rejection_reason', 'TEXT'],
];

async function ensureColumn(db: D1Database, table: string, column: string, type: string): Promise<void> {
  const rows = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  const has = rows.results.some((r) => r.name === column);
  if (!has) await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
}

let schemaPromise: Promise<void> | null = null;

/** Ensure the schema exists on this database (runs at most once per isolate). */
export function ensureSchema(db: D1Database): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      // Probe first; if the schema is already there this is one cheap query.
      const row = await db.prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users','organizations','imports','audit_log','rate_limits','sessions','submissions')`,
      ).all<{ name: string }>();
      if (row.results.length < 7) {
        await db.batch(SCHEMA_STATEMENTS.map((sql) => db.prepare(sql)));
        return;
      }
      // Tables exist — pick up additive columns from later migrations.
      for (const [table, column, type] of COLUMN_UPGRADES) {
        await ensureColumn(db, table, column, type);
      }
    })().catch((err) => {
      schemaPromise = null; // allow retry on transient failure
      throw err;
    });
  }
  return schemaPromise;
}
