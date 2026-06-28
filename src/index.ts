import { Hono } from 'hono'
import type { Env } from './env'
import { handleUpdate } from './telegram'

const app = new Hono<{ Bindings: Env }>()

app.get('/', (c) => c.text('AGENT BOLEK online ✓'))

app.post('/webhook/:secret', async (c) => {
  if (c.req.param('secret') !== c.env.TELEGRAM_WEBHOOK_SECRET) {
    return c.text('Unauthorized', 401)
  }
  const update = await c.req.json()
  c.executionCtx.waitUntil(handleUpdate(update, c.env))
  return c.text('ok')
})

export default app
