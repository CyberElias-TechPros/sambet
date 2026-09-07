-- Public self-registration: organizations pay a registration fee by bank
-- transfer and submit their details + a picture of the proof of payment (POP).
-- Staff verify the payment and either add the organization to the registry
-- or link the submission to an existing record.

CREATE TABLE IF NOT EXISTS submissions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  reference         TEXT NOT NULL UNIQUE,           -- SAM-YYYY-#####
  org_name          TEXT NOT NULL,
  phone             TEXT NOT NULL,                  -- normalized, same rules as organizations.phone
  state             TEXT,                           -- as submitted (canonical state lives on the org once verified)
  bank              TEXT NOT NULL,                  -- as submitted
  account_number    TEXT NOT NULL,                  -- digits only
  account_name      TEXT,
  amount_paid       INTEGER NOT NULL DEFAULT 1000,  -- Nigerian Naira
  payment_date      TEXT,                           -- YYYY-MM-DD (as claimed by the submitter)
  payment_reference TEXT,                           -- optional teller / transaction reference
  notes             TEXT,                           -- submitter's free-text message
  pop_key           TEXT NOT NULL,                  -- R2 key of the proof-of-payment image
  status            TEXT NOT NULL DEFAULT 'pending',-- pending | verified | rejected
  org_id            INTEGER REFERENCES organizations(id),
  reviewed_by       INTEGER REFERENCES users(id),
  reviewed_at       TEXT,
  rejection_reason  TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_submissions_status  ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_phone   ON submissions(phone);
CREATE INDEX IF NOT EXISTS idx_submissions_account ON submissions(account_number);
