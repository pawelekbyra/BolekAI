CREATE TABLE IF NOT EXISTS agents (
  name         TEXT    PRIMARY KEY,
  role         TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'idle',
  current_task TEXT,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id         INTEGER  PRIMARY KEY AUTOINCREMENT,
  agent_name TEXT     NOT NULL,
  task       TEXT     NOT NULL,
  status     TEXT     NOT NULL DEFAULT 'pending',
  result     TEXT,
  chat_id    INTEGER  NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  done_at    DATETIME
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status, agent_name);

-- Seed domyślnych agentów
INSERT OR IGNORE INTO agents (name, role) VALUES
  ('Mailer',     'Pisze i redaguje emaile, drafty, komunikację'),
  ('Researcher', 'Szuka informacji, analizuje dane, tworzy raporty'),
  ('Coder',      'Pisze kod, tworzy PR-y, robi code review'),
  ('Analyst',    'Analizuje dane, wyciąga wnioski, podsumowuje');
