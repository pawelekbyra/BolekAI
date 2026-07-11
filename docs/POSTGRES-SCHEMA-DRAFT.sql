-- Bolek Postgres source-of-truth draft.
-- Status: draft for Faza 7. D1 remains the runtime store until migration is explicit.

CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'denied', 'expired', 'executed', 'failed');
CREATE TYPE durable_task_status AS ENUM ('queued', 'running', 'waiting_for_approval', 'done', 'failed', 'cancelled');

CREATE TABLE approvals (
  id UUID PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  tool_name TEXT NOT NULL,
  risk_level risk_level NOT NULL,
  normalized_args JSONB NOT NULL,
  preview TEXT NOT NULL,
  impact TEXT NOT NULL,
  status approval_status NOT NULL DEFAULT 'pending',
  idempotency_key TEXT NOT NULL UNIQUE,
  result JSONB,
  error TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  denied_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ
);

CREATE INDEX approvals_chat_status_expires_idx ON approvals(chat_id, status, expires_at);
CREATE INDEX approvals_tool_status_created_idx ON approvals(tool_name, status, created_at DESC);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY,
  chat_id BIGINT,
  event_type TEXT NOT NULL,
  tool_name TEXT,
  risk_level risk_level,
  policy_decision TEXT,
  approval_id UUID REFERENCES approvals(id),
  status TEXT,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_chat_created_idx ON audit_events(chat_id, created_at DESC);
CREATE INDEX audit_events_tool_created_idx ON audit_events(tool_name, created_at DESC);
CREATE INDEX audit_events_approval_created_idx ON audit_events(approval_id, created_at DESC);

CREATE TABLE task_runs (
  id UUID PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  status durable_task_status NOT NULL DEFAULT 'queued',
  title TEXT NOT NULL,
  side_effect BOOLEAN NOT NULL DEFAULT false,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX task_runs_status_locked_idx ON task_runs(status, locked_at, queued_at);
CREATE INDEX task_runs_source_idx ON task_runs(source_type, source_id);

CREATE TABLE task_steps (
  id UUID PRIMARY KEY,
  task_run_id UUID NOT NULL REFERENCES task_runs(id),
  step_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  status durable_task_status NOT NULL DEFAULT 'queued',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  input JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX task_steps_run_order_idx ON task_steps(task_run_id, step_order);

CREATE TYPE memory_type AS ENUM ('profile', 'project', 'decision', 'operational', 'episodic');
CREATE TYPE memory_status AS ENUM ('proposed', 'active', 'rejected', 'deleted');
CREATE TYPE memory_sensitivity AS ENUM ('low', 'medium', 'high');
CREATE TYPE embedding_status AS ENUM ('not_indexed', 'queued', 'indexed', 'failed');

CREATE TABLE memory_items (
  id UUID PRIMARY KEY,
  memory_type memory_type NOT NULL,
  status memory_status NOT NULL DEFAULT 'proposed',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  redacted_content TEXT NOT NULL,
  source TEXT NOT NULL,
  source_ref TEXT,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  sensitivity memory_sensitivity NOT NULL DEFAULT 'medium',
  proposed_by TEXT NOT NULL DEFAULT 'agent',
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  embedding_status embedding_status NOT NULL DEFAULT 'not_indexed',
  embedding_model TEXT,
  embedding_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX memory_items_status_type_idx ON memory_items(status, memory_type, updated_at DESC);
CREATE INDEX memory_items_embedding_status_idx ON memory_items(embedding_status, updated_at DESC);
