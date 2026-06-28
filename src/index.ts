import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './env'
import { handleUpdate, send } from './telegram'
import { orchestrateStream } from './orchestrator'
import { runPendingTasks } from './agents/runner'

const app = new Hono<{ Bindings: Env }>()

app.use('/api/*', cors())

app.get('/', (c) => c.text('AGENT BOLEK online ✓'))

app.post('/webhook/:secret', async (c) => {
  if (c.req.param('secret') !== c.env.TELEGRAM_WEBHOOK_SECRET) {
    return c.text('Unauthorized', 401)
  }
  const update = await c.req.json()
  c.executionCtx.waitUntil(handleUpdate(update, c.env))
  return c.text('ok')
})

app.post('/api/chat', async (c) => {
  const { messages, chatId = 0 } = await c.req.json<{
    messages: Array<{ role: string; content: string }>
    chatId?: number
  }>()

  const userMessage = messages.at(-1)?.content ?? ''
  const { stream } = await orchestrateStream(userMessage, chatId, c.env)

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
})

app.get('/api/agents', async (c) => {
  const agents = await c.env.DB
    .prepare('SELECT name, role, status, current_task, updated_at FROM agents ORDER BY name ASC')
    .all()
  return c.json(agents.results)
})

app.get('/api/characters', async (c) => {
  const chars = await c.env.DB
    .prepare('SELECT name, emoji, personality, status, updated_at FROM characters ORDER BY name ASC')
    .all()
  return c.json(chars.results)
})

app.get('/api/characters/messages', async (c) => {
  const msgs = await c.env.DB
    .prepare('SELECT from_char, message, topic, created_at FROM character_messages ORDER BY created_at DESC LIMIT 30')
    .all()
  return c.json(msgs.results)
})

app.get('/api/agents/tasks', async (c) => {
  const tasks = await c.env.DB
    .prepare(`
      SELECT agent_name, task, status, result, created_at, done_at
      FROM agent_tasks
      ORDER BY created_at DESC
      LIMIT 20
    `)
    .all()
  return c.json(tasks.results)
})

async function checkReminders(env: Env): Promise<void> {
  const due = await env.DB
    .prepare(`
      SELECT id, chat_id, message FROM reminders
      WHERE sent = 0 AND remind_at <= CURRENT_TIMESTAMP
      ORDER BY remind_at ASC LIMIT 50
    `)
    .all<{ id: number; chat_id: number; message: string }>()

  if (!due.results?.length) return

  await Promise.all(
    due.results.map(async (r) => {
      await send(env.TELEGRAM_BOT_TOKEN, r.chat_id, `⏰ ${r.message}`)
      await env.DB.prepare('UPDATE reminders SET sent = 1 WHERE id = ?').bind(r.id).run()
    })
  )
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(Promise.all([
      checkReminders(env),
      runPendingTasks(env),
    ]))
  },
}
