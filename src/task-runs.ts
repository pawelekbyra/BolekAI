export type DurableTaskStatus = 'queued' | 'running' | 'waiting_for_approval' | 'done' | 'failed' | 'cancelled'

export type CreateTaskRunInput = {
  id: string
  sourceType: string
  sourceId: string
  title: string
  sideEffect: boolean
  lockedBy: string
}

export type FinishTaskRunInput = {
  runId: string
  status: Extract<DurableTaskStatus, 'done' | 'failed'>
  result: string
}

export type RecordTaskStepInput = {
  runId: string
  stepOrder: number
  name: string
  status: Extract<DurableTaskStatus, 'done' | 'failed'>
  input?: unknown
  output?: unknown
  error?: string
}

export interface TaskRunStorage {
  createRun(input: CreateTaskRunInput): Promise<void>
  finishRun(input: FinishTaskRunInput): Promise<void>
  recordStep(input: RecordTaskStepInput): Promise<void>
}

export class D1TaskRunStore implements TaskRunStorage {
  constructor(private readonly db: D1Database) {}

  async createRun(input: CreateTaskRunInput): Promise<void> {
    await this.db.prepare(`
      INSERT INTO task_runs (
        id, source_type, source_id, status, title, side_effect, attempt_count,
        locked_at, locked_by, started_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'running', ?, ?, 1, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)
      .bind(input.id, input.sourceType, input.sourceId, input.title, input.sideEffect ? 1 : 0, input.lockedBy)
      .run()
  }

  async finishRun(input: FinishTaskRunInput): Promise<void> {
    const resultColumn = input.status === 'done' ? 'result' : 'error'
    await this.db.prepare(`
      UPDATE task_runs
      SET status = ?, ${resultColumn} = ?, finished_at = CURRENT_TIMESTAMP, locked_at = NULL,
          locked_by = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(input.status, input.result, input.runId).run()
  }

  async recordStep(input: RecordTaskStepInput): Promise<void> {
    await this.db.prepare(`
      INSERT INTO task_steps (
        id, task_run_id, step_order, name, status, attempt_count, input, output, error,
        started_at, finished_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)
      .bind(
        crypto.randomUUID(),
        input.runId,
        input.stepOrder,
        input.name,
        input.status,
        input.input === undefined ? null : JSON.stringify(input.input),
        input.output === undefined ? null : JSON.stringify(input.output),
        input.error ?? null
      )
      .run()
  }
}
