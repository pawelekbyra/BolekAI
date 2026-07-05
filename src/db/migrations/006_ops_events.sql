-- Audyt operacyjny Bolka: briefingi, przyszłe akcje ops, integracje Polutka.
CREATE TABLE IF NOT EXISTS ops_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source      TEXT    NOT NULL,
  event_type  TEXT    NOT NULL,
  status      TEXT    NOT NULL,
  message     TEXT    NOT NULL,
  metadata    TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ops_events_source_created
  ON ops_events(source, created_at);

CREATE INDEX IF NOT EXISTS idx_ops_events_type_status
  ON ops_events(event_type, status, created_at);
