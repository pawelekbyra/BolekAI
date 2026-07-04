-- Wykonywalna kolejka akcji czekających na potwierdzenie właściciela.
CREATE TABLE IF NOT EXISTS pending_actions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id     INTEGER NOT NULL,
  description TEXT    NOT NULL,
  tool_name   TEXT    NOT NULL,
  tool_args   TEXT    NOT NULL DEFAULT '{}',
  status      TEXT    NOT NULL DEFAULT 'pending',
  result      TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_pending_actions_chat_status
  ON pending_actions(chat_id, status, created_at);
