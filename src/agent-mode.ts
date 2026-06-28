import type { Env } from './env'
import { send } from './telegram'

export type AgentMode = 'autonomous' | 'confirm' | 'manual'

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
}

export async function runAction({ env, chatId, description, action }: ActionOptions): Promise<string> {
  const mode = await getMode(env.DB)

  if (mode === 'manual') {
    return `Tryb manualny — nie wykonuję akcji. Miałem zrobić: ${description}`
  }

  if (mode === 'confirm') {
    await send(env.TELEGRAM_BOT_TOKEN, chatId, `❓ Mam wykonać: *${description}*\n\nOdpisz "tak" żeby potwierdzić.`)
    await env.DB
      .prepare('INSERT INTO owner_facts (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP')
      .bind('pending_action', description)
      .run()
    return `Czekam na Twoje potwierdzenie.`
  }

  // autonomous
  const result = await action()
  await send(env.TELEGRAM_BOT_TOKEN, chatId, `✅ Wykonano: *${description}*\n\n${result}`)
  return result
}
