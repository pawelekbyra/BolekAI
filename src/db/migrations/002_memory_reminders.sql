-- Fakty o właścicielu — Bolek zapamiętuje kim jesteś
CREATE TABLE IF NOT EXISTS owner_facts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT NOT NULL UNIQUE,
  value      TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Przypomnienia
CREATE TABLE IF NOT EXISTS reminders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id     INTEGER NOT NULL,
  message     TEXT    NOT NULL,
  remind_at   DATETIME NOT NULL,
  sent        INTEGER NOT NULL DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(remind_at, sent);
