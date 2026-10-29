CREATE TABLE IF NOT EXISTS maintainers (
  github_id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('editor', 'publisher', 'admin')),
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO maintainers (github_id, role, updated_by, updated_at)
VALUES ('57414242', 'admin', 'bootstrap-migration', CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  object_key TEXT NOT NULL,
  base_release_id TEXT,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  object_key TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  draft_revision INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS publication_attempts (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_transactions (
  token_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_transactions_expiry ON auth_transactions(expires_at);
CREATE TABLE IF NOT EXISTS browser_sessions (
  token_hash TEXT PRIMARY KEY,
  github_id TEXT NOT NULL,
  csrf_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS browser_sessions_expiry ON browser_sessions(expires_at);
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  github_id TEXT NOT NULL,
  session_hash TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  candidate_hash TEXT NOT NULL,
  base_release_id TEXT,
  action TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE TABLE IF NOT EXISTS request_limits (
  key TEXT PRIMARY KEY,
  window INTEGER NOT NULL,
  count INTEGER NOT NULL
);
