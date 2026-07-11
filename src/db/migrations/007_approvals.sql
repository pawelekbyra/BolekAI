-- Structured approval objects replacing loose chat confirmations for risky tool execution.
CREATE TABLE IF NOT EXISTS approvals (
  id                TEXT    PRIMARY KEY,
  chat_id           INTEGER NOT NULL,
  tool_name         TEXT    NOT NULL,
  risk_level        TEXT    NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  normalized_args   TEXT    NOT NULL DEFAULT '{}',
  preview           TEXT    NOT NULL,
  impact            TEXT    NOT NULL,
  status            TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired', 'executed', 'failed')),
  idempotency_key   TEXT    NOT NULL UNIQUE,
  expires_at        DATETIME NOT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at        DATETIME,
  executed_at       DATETIME,
  failure_reason    TEXT
);

CREATE INDEX IF NOT EXISTS idx_approvals_chat_status
  ON approvals(chat_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_approvals_status_expires
  ON approvals(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_approvals_tool_risk
  ON approvals(tool_name, risk_level, created_at);
