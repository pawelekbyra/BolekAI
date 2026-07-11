CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  chat_id INTEGER,
  event_type TEXT NOT NULL,
  tool_name TEXT,
  risk_level TEXT CHECK (risk_level IS NULL OR risk_level IN ('low', 'medium', 'high', 'critical')),
  policy_decision TEXT,
  approval_id TEXT,
  status TEXT,
  data TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_events_chat_created
  ON audit_events(chat_id, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_events_tool_created
  ON audit_events(tool_name, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_events_approval_created
  ON audit_events(approval_id, created_at);
