import type { Env } from '../env'
import { getAgent } from './registry'
import { send } from '../telegram'

type AgentTask = {
  id: number
  agent_name: string
  task: string
  chat_id: number
}

async function runTask(task: AgentTask, env: Env): Promise<void> {
  const agent = getAgent(task.agent_name)
  if (!agent) return

  await env.DB.prepare(`
    UPDATE agent_tasks SET status = 'running', started_at = CURRENT_TIMESTAMP WHERE id = ?
  `).bind(task.id).run()

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

    await env.DB.prepare(`
      UPDATE agent_tasks SET status = 'done', result = ?, done_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(result, task.id).run()

    await env.DB.prepare(`
      UPDATE agents SET status = 'idle', current_task = NULL, updated_at = CURRENT_TIMESTAMP WHERE name = ?
    `).bind(task.agent_name).run()

    await send(
      env.TELEGRAM_BOT_TOKEN,
      task.chat_id,
      `✅ *${task.agent_name}* skończył zadanie:\n\n${result}`
    )
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Nieznany błąd'

    await env.DB.prepare(`
      UPDATE agent_tasks SET status = 'failed', result = ?, done_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(error, task.id).run()

    await env.DB.prepare(`
      UPDATE agents SET status = 'idle', current_task = NULL, updated_at = CURRENT_TIMESTAMP WHERE name = ?
    `).bind(task.agent_name).run()

    await send(
      env.TELEGRAM_BOT_TOKEN,
      task.chat_id,
      `❌ *${task.agent_name}* napotkał błąd: ${error}`
    )
  }
}

export async function runPendingTasks(env: Env): Promise<void> {
  const pending = await env.DB
    .prepare(`
      SELECT id, agent_name, task, chat_id
      FROM agent_tasks
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 10
    `)
    .all<AgentTask>()

  if (!pending.results?.length) return

  await Promise.all(pending.results.map((task) => runTask(task, env)))
}
