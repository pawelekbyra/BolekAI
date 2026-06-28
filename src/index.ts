import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './env'
import { handleUpdate } from './telegram'
import { orchestrateStream } from './orchestrator'

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

export default app
