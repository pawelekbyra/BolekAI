import type { Env } from './env'
import { send } from './telegram'
import { executeTool } from './tools'

export type AgentMode = 'autonomous' | 'confirm' | 'manual'

export type ActionIntent = {
  tool: string
  args: unknown
}

export type ActionExecutionOptions = {
  approved?: boolean
}

export async function getMode(db: D1Database): Promise<AgentMode> {
  const row = await db
    .prepare('SELECT value FROM owner_facts WHERE key = ?')
    .bind('agent_mode')
    .first<{ value: string }>()

  const value = row?.value ?? 'confirm'
  if (value === 'autonomous' || value === 'manual') return value
  return 'confirm'
}

export async function setMode(db: D1Database, mode: AgentMode): Promise<void> {
  await db
    .prepare(`
      INSERT INTO owner_facts (key, value, updated_at)
      VALUES ('agent_mode', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `)
    .bind(mode)
    .run()
}

type ActionOptions = {
  env: Env
  chatId: number
  description: string
  action: () => Promise<string>
  intent?: ActionIntent
  approved?: boolean
}

export async function runAction({ env, chatId, description, action, intent, approved = false }: ActionOptions): Promise<string> {
  const mode = await getMode(env.DB)

  if (mode === 'manual') {
    return `Tryb manualny — nie wykonuję akcji. Miałem zrobić: ${description}`
  }

  if (approved || mode === 'autonomous') {
    const result = await action()
    await send(env.TELEGRAM_BOT_TOKEN, chatId, `✅ Wykonano: *${description}*\n\n${result}`)
    return result
  }

  if (!intent) {
    return `Ta akcja wymaga potwierdzenia, ale nie ma zapisanej wykonywalnej intencji: ${description}`
  }

  await env.DB
    .prepare(`
      INSERT INTO pending_actions (chat_id, description, tool_name, tool_args, status)
      VALUES (?, ?, ?, ?, 'pending')
    `)
    .bind(chatId, description, intent.tool, JSON.stringify(intent.args ?? {}))
    .run()

  await send(env.TELEGRAM_BOT_TOKEN, chatId, `❓ Mam wykonać: *${description}*\n\nOdpisz "tak" żeby potwierdzić albo "nie" żeby anulować.`)
  return `Czekam na Twoje potwierdzenie.`
}

export async function handleActionConfirmation(text: string, chatId: number, env: Env): Promise<string | null> {
  const normalized = text.trim().toLowerCase()
  const isYes = ['tak', 't', 'yes', 'y'].includes(normalized)
  const isNo = ['nie', 'n', 'no'].includes(normalized)
  if (!isYes && !isNo) return null

  const pending = await env.DB
    .prepare(`
      SELECT id, description, tool_name, tool_args
      FROM pending_actions
      WHERE chat_id = ? AND status = 'pending'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `)
    .bind(chatId)
    .first<{ id: number; description: string; tool_name: string; tool_args: string }>()

  if (!pending) return null

  if (isNo) {
    await env.DB
      .prepare(`UPDATE pending_actions SET status = 'cancelled', resolved_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(pending.id)
      .run()
    return `Anulowałem: ${pending.description}`
  }

  await env.DB
    .prepare(`UPDATE pending_actions SET status = 'running', resolved_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(pending.id)
    .run()

  try {
    const args = JSON.parse(pending.tool_args) as unknown
    const result = await executeTool(pending.tool_name, args, env.DB, chatId, env, { approved: true })
    await env.DB
      .prepare(`UPDATE pending_actions SET status = 'done', result = ? WHERE id = ?`)
      .bind(typeof result === 'string' ? result : JSON.stringify(result), pending.id)
      .run()
    return `Potwierdzone i wykonane: ${pending.description}\n\n${typeof result === 'string' ? result : JSON.stringify(result)}`
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await env.DB
      .prepare(`UPDATE pending_actions SET status = 'failed', result = ? WHERE id = ?`)
      .bind(message, pending.id)
      .run()
    throw err
  }
}
