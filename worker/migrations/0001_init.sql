-- Sambet Grassroots Project — initial schema (D1 / SQLite)

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash    TEXT PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at    TEXT NOT NULL,
  last_ip       TEXT,
  last_ua       TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS organizations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  sn               INTEGER UNIQUE,                -- original S/N from the legacy registry (nullable)
  name             TEXT NOT NULL,
  ceo_name         TEXT,
  phone            TEXT,                          -- normalized E.164 where possible
  email            TEXT,
  bank             TEXT,                          -- raw value as entered
  bank_norm        TEXT,                          -- canonical bank name (NULL if unknown)
  account_number   TEXT,
  lga              TEXT,
  state            TEXT,                          -- raw value as entered
  state_norm       TEXT,                          -- canonical Nigerian state (NULL if unknown)
  project_type     TEXT,                          -- raw description as entered
  project_category TEXT NOT NULL DEFAULT 'Other', -- canonical category
  status           TEXT NOT NULL DEFAULT 'registered',
  notes            TEXT,
  cycle            TEXT NOT NULL DEFAULT 'Project 1',
  source           TEXT NOT NULL DEFAULT 'manual', -- manual | import
  source_import_id INTEGER,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at       TEXT                           -- soft delete
);

CREATE INDEX IF NOT EXISTS idx_org_name ON organizations(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_org_state ON organizations(state_norm);
CREATE INDEX IF NOT EXISTS idx_org_category ON organizations(project_category);
CREATE INDEX IF NOT EXISTS idx_org_bank ON organizations(bank_norm);
CREATE INDEX IF NOT EXISTS idx_org_status ON organizations(status);
CREATE INDEX IF NOT EXISTS idx_org_cycle ON organizations(cycle);
CREATE INDEX IF NOT EXISTS idx_org_updated ON organizations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_phone ON organizations(phone);

-- Duplicate detection uses this key (case/space-insensitive name + state).
CREATE INDEX IF NOT EXISTS idx_org_dup ON organizations(replace(lower(trim(name)), ' ', ''), state_norm);

CREATE TABLE IF NOT EXISTS imports (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  filename        TEXT NOT NULL,
  r2_key          TEXT,
  total_rows      INTEGER NOT NULL DEFAULT 0,
  created_count   INTEGER NOT NULL DEFAULT 0,
  updated_count   INTEGER NOT NULL DEFAULT 0,
  skipped_count   INTEGER NOT NULL DEFAULT 0,
  error_count     INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'completed',
  report          TEXT,                           -- JSON summary (first errors, stats)
  actor_email     TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_email TEXT,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT,
  details     TEXT,                               -- JSON, no sensitive data
  ip          TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 1,
  window_start INTEGER NOT NULL                   -- unix seconds
);
