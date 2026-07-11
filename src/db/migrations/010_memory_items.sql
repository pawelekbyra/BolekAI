CREATE TABLE IF NOT EXISTS memory_items (
  id TEXT PRIMARY KEY,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('profile', 'project', 'decision', 'operational', 'episodic')),
  status TEXT NOT NULL CHECK (status IN ('proposed', 'active', 'rejected', 'deleted')) DEFAULT 'proposed',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  redacted_content TEXT NOT NULL,
  source TEXT NOT NULL,
  source_ref TEXT,
  confidence REAL NOT NULL DEFAULT 0.7,
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('low', 'medium', 'high')) DEFAULT 'medium',
  proposed_by TEXT NOT NULL DEFAULT 'agent',
  approved_at TEXT,
  rejected_at TEXT,
  deleted_at TEXT,
  embedding_status TEXT NOT NULL CHECK (embedding_status IN ('not_indexed', 'queued', 'indexed', 'failed')) DEFAULT 'not_indexed',
  embedding_model TEXT,
  embedding_ref TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memory_items_status_type
  ON memory_items(status, memory_type, updated_at);

CREATE INDEX IF NOT EXISTS idx_memory_items_embedding_status
  ON memory_items(embedding_status, updated_at);
