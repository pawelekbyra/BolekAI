CREATE TABLE IF NOT EXISTS task_runs (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'waiting_for_approval', 'done', 'failed', 'cancelled')) DEFAULT 'queued',
  title TEXT NOT NULL,
  side_effect INTEGER NOT NULL DEFAULT 0,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  locked_at TEXT,
  locked_by TEXT,
  queued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  finished_at TEXT,
  result TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_steps (
  id TEXT PRIMARY KEY,
  task_run_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'waiting_for_approval', 'done', 'failed', 'cancelled')) DEFAULT 'queued',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  input TEXT,
  output TEXT,
  error TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_run_id) REFERENCES task_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_task_runs_status_locked
  ON task_runs(status, locked_at, queued_at);

CREATE INDEX IF NOT EXISTS idx_task_runs_source
  ON task_runs(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_task_steps_run_order
  ON task_steps(task_run_id, step_order);

ALTER TABLE agent_tasks ADD COLUMN side_effect INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_tasks ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_tasks ADD COLUMN locked_at DATETIME;
ALTER TABLE agent_tasks ADD COLUMN locked_by TEXT;
ALTER TABLE agent_tasks ADD COLUMN run_id TEXT;

CREATE INDEX IF NOT EXISTS idx_agent_tasks_queue_lock
  ON agent_tasks(status, side_effect, locked_at, created_at);
