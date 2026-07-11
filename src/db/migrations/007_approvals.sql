CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  chat_id INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  normalized_args TEXT NOT NULL,
  preview TEXT NOT NULL,
  impact TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied', 'expired', 'executed', 'failed')) DEFAULT 'pending',
  idempotency_key TEXT NOT NULL UNIQUE,
  result TEXT,
  error TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  denied_at TEXT,
  executed_at TEXT,
  failed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_approvals_chat_status_expires
  ON approvals(chat_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_approvals_tool_status
  ON approvals(tool_name, status, created_at);
