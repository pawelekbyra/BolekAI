# BolekAI — Development Guide

> How to develop and extend Agent Bolek's core orchestrator.

---

## Quick Start

```bash
# Setup
npm install
wrangler login

# Development
npm run dev              # Start local worker on :8787

# Testing
curl -X POST http://localhost:8787/webhook/zajebiscie \
  -H "X-Telegram-Bot-Api-Secret-Token: test" \
  -d '{"message":{"text":"hello"}}'

# Deploy
npm run deploy
```

---

## Architecture Layers

### Layer 1: Worker Entry (`src/index.ts`)
- Route requests (Telegram webhook, HTTP APIs)
- Auth checks
- Response formatting

### Layer 2: Orchestrator (`src/orchestrator.ts`)
- Parse user intent
- Call LLM for decision-making
- Dispatch to tools
- Manage conversation flow

### Layer 3: Memory (`src/memory.ts`)
- D1 database operations
- KV cache management
- Context retrieval

### Layer 4: Tools (`src/tools/`)
- Built-in tools (tasks, notes, reminders, facts)
- External service clients (chat, workflow, knowledge)
- Tool registry and dispatcher

### Layer 5: Interfaces (`src/telegram.ts`)
- Telegram bot adapter
- Message formatting
- Command parsing

---

## Adding a Built-in Tool

**Example: Finance tracker**

1. Create `src/tools/finance.ts`:

```typescript
export const financeTools = [
  {
    name: 'finance_add_expense',
    description: 'Record an expense',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        category: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['amount', 'category'],
    },
  },
]

export async function executeFinanceTool(
  name: string,
  args: unknown,
  db: D1Database
): Promise<unknown> {
  const { amount, category, notes } = args as any
  
  if (name === 'finance_add_expense') {
    await db.prepare(`
      INSERT INTO expenses (amount, category, notes)
      VALUES (?, ?, ?)
    `).bind(amount, category, notes || null).run()
    
    return { success: true, message: 'Expense recorded' }
  }
}
```

2. Update `src/tools/index.ts`:

```typescript
import { financeTools, executeFinanceTool } from './finance'

export const tools = [
  // ... existing
  ...financeTools,  // ADD THIS
]

export async function executeTool(name, args, db, chatId, env, options) {
  // ... existing dispatches
  if (name.startsWith('finance_')) return executeFinanceTool(name, args, db)
}
```

3. Add database migration `src/db/migrations/NNN_expenses.sql`:

```sql
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

4. Apply migration:

```bash
wrangler d1 migrations apply bolek-memory --local
```

Done — agent automatically knows the tool.

---

## Integrating an External Service

**Example: Connect a new service (BolekEmail)**

1. Create `src/tools/external/email-service.ts`:

```typescript
export const emailServiceTools = [
  {
    name: 'email_send',
    description: 'Send an email via BolekEmail',
    parameters: { /* ... */ },
  },
]

export async function executeEmailServiceTool(
  name: string,
  args: unknown,
  env: Env
): Promise<unknown> {
  // HTTP call to service
}
```

2. Update `src/env.ts`:

```typescript
export type Env = {
  // ... existing
  EMAIL_SERVICE_URL?: string
  EMAIL_SERVICE_TOKEN?: string
}
```

3. Register in `src/tools/index.ts`:

```typescript
import { emailServiceTools, executeEmailServiceTool } from './external/email-service'

export const tools = [
  // ... existing
  ...emailServiceTools,  // ADD THIS
]

if (name.startsWith('email_')) return executeEmailServiceTool(name, args, env!)
```

4. Deploy and configure:

```bash
npm run deploy

# Set secrets in Cloudflare
wrangler secret put EMAIL_SERVICE_URL
wrangler secret put EMAIL_SERVICE_TOKEN
```

Done — agent uses the new service.

---

## Testing Tools

### Unit Test
```typescript
// Test a tool directly
const result = await executeTaskTool('task_create', {
  title: 'Test task',
  description: 'Testing',
}, db)

expect(result.success).toBe(true)
```

### Integration Test
```typescript
// Test agent → tool flow
const response = await orchestrate(
  'add task: buy milk',
  { db, env, chatId: 123 }
)

expect(response).toContain('task created')
```

### Manual Test (Local)
```bash
npm run dev

# In another terminal
curl -X POST http://localhost:8787/webhook/zajebiscie \
  -H "X-Telegram-Bot-Api-Secret-Token: test" \
  -d '{"message":{"text":"add task: test"}}'
```

---

## Database Migrations

**Always use migrations, never ALTER directly.**

```bash
# Create migration
echo "CREATE TABLE expenses (...);" > src/db/migrations/001_expenses.sql

# Apply locally
wrangler d1 migrations apply bolek-memory --local

# Deploy
npm run deploy  # Applies to production automatically
```

**Migration best practices:**
- One logical change per migration
- Use IF NOT EXISTS / IF EXISTS for idempotency
- Never delete data (archive instead)
- Test locally first

---

## Environment Variables

### Required (must be set)
```env
TELEGRAM_BOT_TOKEN=          # from BotFather
TELEGRAM_WEBHOOK_SECRET=     # random string
```

### AI (pick one)
```env
ANTHROPIC_API_KEY=          # Claude (recommended)
AI_MODEL=@cf/meta/llama...  # or Workers AI
```

### Optional Services
```env
GITHUB_TOKEN=               # for GitHub integration
VERCEL_TOKEN=               # for Vercel integration
STRIPE_KEY=                 # for Stripe ops
# ... others

# External services (tri-tier architecture)
CHAT_SERVICE_URL=           # BolekCzat
CHAT_SERVICE_TOKEN=
FLOW_SERVICE_URL=           # BolekFlow
FLOW_SERVICE_TOKEN=
KB_SERVICE_URL=             # BolekKB
KB_SERVICE_TOKEN=
```

---

## Performance & Limits

### Cloudflare Workers Limits
- **CPU time:** 30s (30,000ms)
- **Memory:** 128MB
- **Request timeout:** 30s
- **Payload size:** 100MB

**Strategy:** If task > 30s, run async via external service or scheduled job.

### D1 Database
- **Query timeout:** 30s
- **Row limit per query:** ~10,000
- **Concurrent writes:** Serialized (use KV for caching)

**Strategy:** Paginate large queries, index frequently-searched columns.

### KV Store
- **Value size:** 25MB max
- **Consistency:** Eventual (2-60s globally)

**Strategy:** Use for caching, not source of truth.

---

## Monitoring & Debugging

### Local Logs
```bash
npm run dev  # Streaming logs in terminal
```

### Production Logs
```bash
wrangler tail -f  # Real-time tail of worker
```

### Common Issues

**"Unknown tool"**
→ Check if tool is registered in `src/tools/index.ts` dispatcher

**"D1 query failed"**
→ Run migration locally: `wrangler d1 migrations apply bolek-memory --local`

**"Service unavailable"**
→ Check environment variables: `wrangler secret list`

**"LLM timeout"**
→ Increase context limit or retry with simpler query

---

## Code Style

- **TypeScript strict mode** — enable in tsconfig
- **No `any` type** — use proper types
- **Async/await** — no callback hell
- **Const over let** — immutability preferred
- **Descriptive names** — function names describe what they do

---

## PR Checklist Before Pushing

- [ ] Code builds (`npm run typecheck`)
- [ ] No ESLint errors
- [ ] Migration applied locally (if DB change)
- [ ] Tool registered in dispatcher
- [ ] Tested manually or with unit test
- [ ] Commit message is descriptive
- [ ] No secrets in code

---

## Deployment

```bash
# Test
npm run typecheck
npm run dev

# Deploy
npm run deploy

# Verify
wrangler tail -f
# Send test message to @agent_bolek_bot on Telegram
```

---

## Current Phase

See [`PROJECT_STATUS.md`](PROJECT_STATUS.md) for what's next.

---

## Architecture References

- [`docs/MULTI-AGENT-ARCHITECTURE.md`](docs/MULTI-AGENT-ARCHITECTURE.md) — How 4 services work together
- [`docs/BOLEK-NETWORK.md`](docs/BOLEK-NETWORK.md) — High-level ecosystem
- [`docs/POLUTEK-INTEGRATION.md`](docs/POLUTEK-INTEGRATION.md) — Polutek-specific ops
