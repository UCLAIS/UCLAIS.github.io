CREATE TABLE IF NOT EXISTS operation_metrics (
  hour INTEGER NOT NULL,
  service TEXT NOT NULL CHECK (service IN ('auth', 'admin')),
  outcome TEXT NOT NULL CHECK (outcome IN ('auth_failure', 'import_failure', 'publication_success', 'publication_failure', 'request_error', 'request_success')),
  count INTEGER NOT NULL DEFAULT 1 CHECK (count > 0),
  PRIMARY KEY (hour, service, outcome)
);
