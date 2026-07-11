import type { Env } from '../env'
import { getAgent } from './registry'
import { send } from '../telegram'
import { auditEvent } from '../audit'
import { D1TaskRunStore } from '../task-runs'

type AgentTask = {
  id: number
  agent_name: string
  task: string
  chat_id: number
  side_effect: number
}

const MAX_PARALLEL_TASKS = 10
const MAX_PARALLEL_SIDE_EFFECT_TASKS = 1

async function claimTask(task: AgentTask, env: Env, lockedBy: string, runId: string): Promise<boolean> {
  const result = await env.DB.prepare(`
    UPDATE agent_tasks
    SET status = 'running', started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
        attempt_count = attempt_count + 1, locked_at = CURRENT_TIMESTAMP,
        locked_by = ?, run_id = ?
    WHERE id = ? AND status IN ('pending', 'queued') AND locked_at IS NULL
  `).bind(lockedBy, runId, task.id).run()

  return Boolean(result.meta.changes)
}

async function releaseAgent(env: Env, task: AgentTask): Promise<void> {
  await env.DB.prepare(`
    UPDATE agents SET status = 'idle', current_task = NULL, updated_at = CURRENT_TIMESTAMP WHERE name = ?
  `).bind(task.agent_name).run()
}

async function runTask(task: AgentTask, env: Env, lockedBy: string): Promise<void> {
  const agent = getAgent(task.agent_name)
  if (!agent) return

  const runId = crypto.randomUUID()
  const claimed = await claimTask(task, env, lockedBy, runId)
  if (!claimed) return

  const taskRunStore = new D1TaskRunStore(env.DB)
  await taskRunStore.createRun({
    id: runId,
    sourceType: 'agent_task',
    sourceId: String(task.id),
    title: `${task.agent_name}: ${task.task}`,
    sideEffect: task.side_effect === 1,
    lockedBy,
  })

  await env.DB.prepare(`
    UPDATE agents SET status = 'working', current_task = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?
  `).bind(task.task, task.agent_name).run()

  try {
    const ai = env.AI as Ai
    const response = await (ai.run as Function)(env.AI_MODEL, {
      messages: [
        { role: 'system', content: agent.systemPrompt },
        { role: 'user', content: task.task },
      ],
    }) as { response?: string }

    const result = response.response ?? 'Brak odpowiedzi.'

    await taskRunStore.recordStep({
      runId,
      stepOrder: 1,
      name: 'agent_model_response',
      status: 'done',
      input: { agentName: task.agent_name, task: task.task },
      output: { result },
    })

    await env.DB.prepare(`
      UPDATE agent_tasks
      SET status = 'done', result = ?, done_at = CURRENT_TIMESTAMP,
          locked_at = NULL, locked_by = NULL
      WHERE id = ?
    `).bind(result, task.id).run()

    await taskRunStore.finishRun({ runId, status: 'done', result })
    await releaseAgent(env, task)

    await auditEvent(env.DB, {
      chatId: task.chat_id,
      eventType: 'tool_executed',
      toolName: 'agent_task_runner',
      status: 'done',
      data: { runId, taskId: task.id, agentName: task.agent_name, sideEffect: task.side_effect === 1 },
    })

    await send(
      env.TELEGRAM_BOT_TOKEN,
      task.chat_id,
      `✅ *${task.agent_name}* skończył zadanie:

${result}`
    )
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Nieznany błąd'

    await taskRunStore.recordStep({
      runId,
      stepOrder: 1,
      name: 'agent_model_response',
      status: 'failed',
      input: { agentName: task.agent_name, task: task.task },
      error,
    })

    await env.DB.prepare(`
      UPDATE agent_tasks
      SET status = 'failed', result = ?, done_at = CURRENT_TIMESTAMP,
          locked_at = NULL, locked_by = NULL
      WHERE id = ?
    `).bind(error, task.id).run()

    await taskRunStore.finishRun({ runId, status: 'failed', result: error })
    await releaseAgent(env, task)

    await auditEvent(env.DB, {
      chatId: task.chat_id,
      eventType: 'tool_failed',
      toolName: 'agent_task_runner',
      status: 'failed',
      data: { runId, taskId: task.id, agentName: task.agent_name, sideEffect: task.side_effect === 1, error },
    })

    await send(
      env.TELEGRAM_BOT_TOKEN,
      task.chat_id,
      `❌ *${task.agent_name}* napotkał błąd: ${error}`
    )
  }
}

export async function runPendingTasks(env: Env): Promise<void> {
  const runningSideEffects = await env.DB
    .prepare(`SELECT COUNT(*) AS count FROM agent_tasks WHERE status = 'running' AND side_effect = 1`)
    .first<{ count: number }>()
  const sideEffectSlots = Math.max(0, MAX_PARALLEL_SIDE_EFFECT_TASKS - (runningSideEffects?.count ?? 0))

  const pending = await env.DB
    .prepare(`
      SELECT id, agent_name, task, chat_id, side_effect
      FROM agent_tasks
      WHERE status IN ('pending', 'queued') AND locked_at IS NULL
      ORDER BY created_at ASC
      LIMIT ?
    `)
    .bind(MAX_PARALLEL_TASKS)
    .all<AgentTask>()

  if (!pending.results?.length) return

  let selectedSideEffects = 0
  const selected = pending.results.filter((task) => {
    if (task.side_effect !== 1) return true
    if (selectedSideEffects >= sideEffectSlots) return false
    selectedSideEffects += 1
    return true
  })

  const lockedBy = `agent-runner:${crypto.randomUUID()}`
  await Promise.all(selected.map((task) => runTask(task, env, lockedBy)))
}
