-- Import approval workflow + team (role) management.
-- All statements are additive; existing data is untouched.

-- Staff accounts can be disabled without deleting their history/audit trail.
ALTER TABLE users ADD COLUMN disabled_at TEXT;

-- Imports can now sit in a review queue:
--   status: pending → completed | rejected   (running/failed as before)
ALTER TABLE imports ADD COLUMN payload_key TEXT;      -- R2 key of parsed rows (pending only)
ALTER TABLE imports ADD COLUMN reviewed_by TEXT;      -- admin e-mail
ALTER TABLE imports ADD COLUMN reviewed_at TEXT;
ALTER TABLE imports ADD COLUMN rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_imports_status ON imports(status);
