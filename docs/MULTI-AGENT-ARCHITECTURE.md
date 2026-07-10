# Multi-Agent Architecture — Tri-Tier System Design

> **Status:** Architecture plan for integrating BolekAI with BolekCzat, BolekFlow, and BolekKB as external services.
>
> This document defines how the **Agent Bolek core** (BolekAI) orchestrates and communicates with specialized service providers.

---

## 1. Principle: Agent + Services, Not Monolith

BolekAI is a **lean, focused orchestrator** — not a monolithic system. Each external system is treated as a **pluggable service** with a clear HTTP API contract.

```
┌──────────────────────────────────────────────────┐
│         AGENT BOLEK CORE (Cloudflare Worker)     │
│         ──────────────────────────────────────   │
│  - Orchestrator (planning, tool selection)       │
│  - Memory (D1 + KV)                              │
│  - Tool dispatcher                               │
│  - Telegram interface                            │
│  - Policy / approval gate                        │
│  - Built-in tools (tasks, reminders, notes)      │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────┼──────────┬──────────┐
        ▼          ▼          ▼          ▼
   ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────┐
   │BolekCzat│ │BolekFlow │ │BolekKB │ │Others │
   │ Service │ │ Service  │ │Service │ │(future)
   │ (chat)  │ │(workflow)│ │(knowl.)│ │
   └─────────┘ └──────────┘ └────────┘ └───────┘
      API        API         API        API
```

**Key principle:** Each service is **independently deployable**, has its own database, can evolve separately, and communicates via **HTTP API only**.

```txt
BolekAI myśli.
BolekCzat pokazuje.
BolekKB pamięta dokumenty.
BolekFlow automatyzuje.
BolekDev koduje.
Paweł zatwierdza ryzykowne akcje.
```

---

## 2. Tier 1: Agent Core (BolekAI)

### Responsibilities

- Parse user intent
- Plan actions
- Route to appropriate tools
- Call external services (via HTTP)
- Manage local memory and state
- Enforce policy and approvals
- Telegram bot interface
- Respond to user

### What Lives Here

```
src/
  index.ts                    # Worker entry
  orchestrator.ts             # Intent parsing, planning, dispatch
  memory.ts                   # D1 + KV helpers
  telegram.ts                 # Telegram adapter
  policy-engine.ts            # Approval gates
  tools/
    index.ts                  # Tool registry
    tasks.ts                  # Built-in tasks
    reminders.ts              # Built-in reminders
    notes.ts                  # Built-in notes
    facts.ts                  # Built-in memory facts
    polutek.ts                # Built-in Polutek ops
    stripe.ts                 # Built-in Stripe
    github.ts                 # Built-in GitHub
    external/
      chat-service.ts         # BolekCzat HTTP client
      workflow-service.ts     # BolekFlow HTTP client
      knowledge-service.ts    # BolekKB HTTP client
db/
  schema.sql                  # D1 schema
wrangler.toml                 # Cloudflare config
```

### Size & Scope

- **~36 files** (as is today, + external service clients)
- **No monolithic bloat**
- **Fast iteration** — core logic is testable, tight, focused
- **Extensible** — adding new external service = new client file + 1 line in registry

---

## 3. Tier 2: External Services (BolekCzat, BolekFlow, BolekKB)

Each service has:

- **Own repository** (keeps them independent)
- **Own database** (if needed)
- **Own deployment** (can scale separately)
- **Standardized HTTP API** (contract with agent)
- **Minimal secrets** (scoped only for their domain)

### 3.1 BolekCzat Service

**Role:** Chat interface, conversation management, web UI

**Hosted:** Anywhere (Vercel, Docker, self-hosted)

**Database:** MongoDB (already has)

**API Contract:**

```typescript
// POST /api/agent/message
{
  userId: string
  conversationId: string
  message: string
  context?: {
    memories: string[]
    recentEvents: string[]
  }
}

Response:
{
  success: boolean
  conversationId: string
  response: string
  toolCalls?: Array<{
    toolName: string
    arguments: unknown
  }>
  metadata?: {
    tokensUsed: number
    duration: number
  }
}
```

**What BolekCzat Owns:**
- Chat history UI
- Conversation threads
- User sessions
- Auth (Clerk, etc.)
- UI/UX

**What BolekCzat Does NOT Own:**
- Secret credentials
- Decision-making
- Policy enforcement
- Memory management

---

### 3.2 BolekFlow Service

**Role:** Workflow automation, process execution

**Hosted:** Anywhere (Docker, Vercel, self-hosted)

**Database:** n8n's database (already has)

**API Contract:**

```typescript
// POST /api/agent/workflows/execute
{
  workflowId: string
  inputs?: Record<string, unknown>
  approval?: {
    id: string
    token: string
  }
  timeout?: number
}

Response:
{
  success: boolean
  runId: string
  status: 'running' | 'completed' | 'failed'
  output?: unknown
  errors?: string[]
  logs?: Array<{
    timestamp: string
    level: 'info' | 'warn' | 'error'
    message: string
  }>
}

// GET /api/agent/workflows/:workflowId/status/:runId
Response:
{
  runId: string
  status: 'running' | 'completed' | 'failed'
  progress?: number
  output?: unknown
}

// GET /api/agent/workflows/list
Response:
{
  workflows: Array<{
    id: string
    name: string
    description: string
    triggers: string[]
  }>
}
```

**What BolekFlow Owns:**
- Workflow definitions
- Execution engine
- n8n nodes
- Automation logic

**What BolekFlow Does NOT Own:**
- Approval decisions
- Risk assessment
- Integration secrets (scoped by agent)

---

### 3.3 BolekKB Service

**Role:** Knowledge base, document storage, RAG

**Hosted:** Anywhere (Docker, Vercel, self-hosted)

**Database:** AnythingLLM's vector DB + metadata

**API Contract:**

```typescript
// POST /api/agent/knowledge/query
{
  query: string
  topK?: number
  filters?: {
    collection?: string
    tags?: string[]
  }
}

Response:
{
  results: Array<{
    id: string
    content: string
    metadata: {
      source: string
      date: string
      relevance: number
    }
  }>
  usage?: {
    tokensUsed: number
  }
}

// POST /api/agent/knowledge/store
{
  content: string
  metadata: {
    source: string
    tags?: string[]
    collection: string
  }
}

Response:
{
  success: boolean
  documentId: string
}

// GET /api/agent/knowledge/collections
Response:
{
  collections: Array<{
    name: string
    documentCount: number
  }>
}
```

**What BolekKB Owns:**
- Document storage
- Vector embeddings
- Search/retrieval
- Collections

**What BolekKB Does NOT Own:**
- Filtering decisions
- Access control (agent enforces)

---

### 3.4 BolekDev Service

**Role:** Coding executor

**Base:** OpenHands / Agent Canvas

**Hosted:** Anywhere (Docker, VPS, self-hosted)

**Target responsibilities:**
- Accept coding tasks
- Clone/mount the target repo
- Create branches
- Edit code
- Run tests, typecheck, lint, build
- Commit changes
- Open pull requests
- Report results back to BolekAI

**What BolekDev Does NOT Own:**
- Merge decisions
- Production deploys
- Approval/risk decisions

BolekDev works through branch → PR only. It never merges or deploys production without explicit owner approval.

Docs live in its own repo: `pawelekbyra/BolekDev/docs/BOLEKDEV-ARCHITECTURE.md`.

---

## 4. Tool Registration in BolekAI

Each external service is registered as a **tool** in the orchestrator:

```typescript
// src/tools/external/chat-service.ts
export const chatServiceTool = {
  name: 'chat_send_message',
  description: 'Send a message via chat interface',
  schema: {
    type: 'object',
    properties: {
      conversationId: { type: 'string' },
      message: { type: 'string' },
    },
    required: ['message']
  },
  async execute(input: unknown) {
    const { conversationId, message } = input as any
    const response = await fetch(`${CHAT_SERVICE_URL}/api/agent/message`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${CHAT_SERVICE_TOKEN}` },
      body: JSON.stringify({ conversationId, message })
    })
    return response.json()
  }
}

// src/tools/external/workflow-service.ts
export const workflowServiceTool = {
  name: 'flow_execute_workflow',
  description: 'Execute a workflow in BolekFlow',
  schema: { /* ... */ },
  async execute(input: unknown) { /* ... */ }
}

// src/tools/external/knowledge-service.ts
export const knowledgeServiceTool = {
  name: 'kb_query',
  description: 'Query knowledge base',
  schema: { /* ... */ },
  async execute(input: unknown) { /* ... */ }
}

// src/tools/index.ts
export const tools = [
  tasksTool,
  remindersTool,
  notesTool,
  // ... built-in tools
  chatServiceTool,
  workflowServiceTool,
  knowledgeServiceTool,
  // ... add more services here
]
```

**Benefits:**

- ✅ **Unified dispatch** — agent treats all tools (built-in + external) the same way
- ✅ **Consistent schema** — LLM sees tool catalog automatically
- ✅ **No special cases** — KB query works like any other tool
- ✅ **Extensible** — add new service = new tool file + 1 line in registry
- ✅ **Testable** — each tool is a pure function

---

## 5. Runtime Flow: User Input → Tool Execution → Response

```
User: "Send a message to chat and log it"
  │
  ▼
Agent.orchestrate(userInput)
  │
  ├─ Parse intent: [chat_send_message, notes_create]
  ├─ Call LLM with tools catalog
  │
  ▼
LLM responds:
  {
    "toolCalls": [
      { "tool": "chat_send_message", "args": { "message": "..." } },
      { "tool": "notes_create", "args": { "content": "..." } }
    ]
  }
  │
  ▼
Policy engine checks:
  - Is tool allowed? (yes, both are low-risk)
  - Are scopes available? (yes)
  - Is approval needed? (no)
  │
  ▼
Dispatcher executes in parallel:
  - chatServiceTool.execute() → HTTP POST to BolekCzat
  - notesTool.execute() → local D1 write
  │
  ▼
Results aggregated:
  {
    chat_send_message: { success: true, conversationId: "..." },
    notes_create: { success: true, noteId: "..." }
  }
  │
  ▼
Agent formats response → send to Telegram
```

---

## 6. Security Model

### Principles

1. **Least privilege:** Each service gets only what it needs
2. **API tokens:** Agent authenticates to services via bearer tokens
3. **No secret sprawl:** Service-to-service calls go through agent only
4. **Policy enforcement:** Agent owns all risk decisions
5. **Audit trail:** Each tool call is logged
6. **BolekCzat gets no operational secrets** — it only talks to BolekAI
7. **BolekKB never executes actions** — it only serves knowledge/sources
8. **BolekFlow never bypasses approval** for mutating actions
9. **BolekDev works through branch/PR only** — no direct push to main
10. **Merge, deploy, refund, patron revoke, sending important emails, and price changes always require explicit owner approval**

### Environment Variables

```env
# BolekAI core
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...

# External service URLs + tokens
CHAT_SERVICE_URL=https://bolekczat.example.com
CHAT_SERVICE_TOKEN=...

WORKFLOW_SERVICE_URL=https://bolekflow.example.com
WORKFLOW_SERVICE_TOKEN=...

KB_SERVICE_URL=https://bolekkb.example.com
KB_SERVICE_TOKEN=...
```

### Example: BolekFlow cannot access Stripe keys

```typescript
// ✅ OK: Agent decides to refund
orchestrate("refund 50 USD for user@example.com")
  → LLM chooses: stripe_refund + flow_log_transaction
  → Policy checks: CRITICAL RISK, needs approval
  → User approves in Telegram
  → Agent calls stripe_refund (has key)
  → Agent calls flow_log_transaction (via HTTP)

// ❌ NOT OK: BolekFlow directly has Stripe key
// BolekFlow only knows about the transaction ID,
// never the secret key. Agent is the only one with secrets.
```

---

## 7. Deployment Topology

### Development

```
localhost:8787 → BolekAI (wrangler dev)
localhost:3000 → BolekCzat (npm run dev)
localhost:5678 → BolekFlow (docker-compose)
localhost:3001 → BolekKB (docker-compose)

All talk via localhost HTTP
```

### Production

```
Cloudflare Workers → BolekAI
Vercel → BolekCzat (or self-hosted)
Docker/VPS → BolekFlow (or self-hosted)
Docker/VPS → BolekKB (or self-hosted)

BolekAI → calls services via public HTTPS URLs
Each service behind own auth (API tokens)
```

---

## 8. Testing Strategy

### Unit Tests (Per Service)

```bash
# BolekAI
npm test  # Test orchestrator, tools, memory

# BolekCzat
npm test  # Test chat logic, API endpoints

# BolekFlow
npm test  # Test workflow execution

# BolekKB
npm test  # Test knowledge queries, indexing
```

### Integration Tests (Agent + Services)

```bash
# Start all services locally
docker-compose up

# Run integration tests
npm run test:integration
  - Agent sends message → BolekCzat stores it
  - Agent queries KB → gets relevant docs
  - Agent runs workflow → gets execution status
```

---

## 9. Rollout Phases

### Phase 1: Core + BolekCzat (Now)

- ✅ BolekAI Cloudflare Worker stable
- ✅ BolekCzat as web interface
- Tool: `chat_service` for message exchange

### Phase 2: Add BolekFlow (Q2)

- BolekAI + workflow execution
- Tools: `flow_execute`, `flow_status`, `flow_list`
- Approval gates for high-risk workflows

### Phase 3: Add BolekKB (Q3)

- BolekAI + knowledge queries
- Tools: `kb_query`, `kb_store`, `kb_collections`
- Context-aware decision making

### Phase 4: More Services (Q4+)

- BolekDev (coding executor) — first manual coding task → branch → PR before any automation
- BolekEmail (email management)
- BolekCalendar (scheduling)
- BolekMoney (financial analysis)
- ...any new domain

Recommended fine-grained order within these phases:

1. BolekAI: stable `/v1/chat/completions` adapter.
2. BolekCzat: LibreChat as web UI to BolekAI.
3. BolekKB: test knowledge base with manual documents.
4. BolekFlow: first safe workflow with no secrets.
5. BolekDev: first manual coding task → branch → PR.
6. BolekAI: add `kb_*`, `flow_*`, `dev_*` tools.
7. BolekCzat: convenient panels/status views for workflows, knowledge, and coding tasks.

---

## 10. Example: Complete User Flow

**User:** "Create a note about the conversation, run the daily briefing workflow, and ask the KB for similar past decisions"

**BolekAI Execution:**

```
Input: "Create a note about the conversation, run the daily briefing workflow, 
        and ask the KB for similar past decisions"

Step 1: Parse intent
  → [notes_create, flow_execute, kb_query]

Step 2: Fetch context
  → recent conversation history
  → available workflows
  → user preferences

Step 3: Plan actions
  → kb_query("past decisions") — read-only, low-risk, autonomous
  → notes_create("conversation summary") — write, low-risk, autonomous
  → flow_execute("daily_briefing") — side effect, medium-risk, may need approval

Step 4: Call LLM to refine plan
  → LLM sees tools catalog, chooses exact tool calls

Step 5: Policy check
  → kb_query: allow (read-only)
  → notes_create: allow (low-risk write)
  → flow_execute: check approval (medium-risk, but user has trusted this workflow)
    → if in "trusted workflows" list → allow
    → else → require approval

Step 6: Execute tools in parallel
  ├─ kb_query("similar decisions")
  │   └─ HTTP POST /api/agent/knowledge/query to BolekKB
  │       → [doc1, doc2, doc3] with relevance scores
  │
  ├─ notes_create("conversation summary")
  │   └─ Direct D1 insert
  │
  └─ flow_execute("daily_briefing")
      └─ HTTP POST /api/agent/workflows/execute to BolekFlow
          → { runId: "xyz", status: "running" }

Step 7: Aggregate results
  → KB returned 3 relevant decisions
  → Note created with ID "note_123"
  → Workflow started with run ID "run_456"

Step 8: Format response for user
  → "I've created a note (link), started the briefing workflow, 
     and found 3 similar past decisions. Here's what we decided:..."

Step 9: Send to Telegram
  → Final response with links and summary
```

---

## 11. Future: Adding a New Service (Example: BolekMoney)

**Step 1:** Create service repo with API

```
pawelekbyra/BolekMoney
├── src/
│   ├── routes/
│   │   └── /api/agent/accounts/*
│   │   └── /api/agent/transactions/*
│   │   └── /api/agent/analysis/*
│   └── ...
```

**Step 2:** Define API contract

```typescript
POST /api/agent/accounts/balance
POST /api/agent/transactions/list
POST /api/agent/analysis/spend-pattern
POST /api/agent/analysis/forecast
```

**Step 3:** Add tool to BolekAI

```typescript
// src/tools/external/money-service.ts
export const moneyServiceTool = {
  name: 'money_get_balance',
  description: 'Check account balance',
  schema: { /* ... */ },
  async execute(input: unknown) { /* ... */ }
}

// src/tools/index.ts — add 1 line
export const tools = [
  // ... existing tools
  moneyServiceTool,  // ← NEW
]
```

**Step 4:** Test

```bash
curl -X POST http://localhost:3003/api/agent/accounts/balance
```

**Step 5:** Deploy

- BolekMoney to its own host
- Add `MONEY_SERVICE_URL` and `MONEY_SERVICE_TOKEN` to BolekAI env
- Restart BolekAI
- Done — agent automatically uses the new tool

**No agent refactor needed. No merging services. No monolithic bloat.**

---

## 12. FAQ

### Q: Why not put everything in one repo?

A: **Monoliths decay.** 20k+ files become unmaintainable. Separate repos = independent scaling, clear ownership, faster iteration on each domain.

### Q: What if a service is down?

A: Agent gracefully fails:

```typescript
try {
  const result = await flowServiceTool.execute(input)
} catch (error) {
  policy.log('workflow_service_unavailable', { error })
  agent.respond("Can't reach workflow service. Try again later?")
}
```

### Q: How does agent know which service to call?

A: **LLM sees the tool catalog.** When you train the model with tool schemas, it learns which tool solves which problem.

```typescript
const allTools = [
  { name: 'notes_create', description: 'Save a note', ... },
  { name: 'flow_execute', description: 'Run a workflow', ... },
  { name: 'kb_query', description: 'Search knowledge base', ... },
]

// LLM sees all tools and chooses the right ones for each request
```

### Q: Can services call each other?

A: **Only through agent.** BolekFlow shouldn't call BolekKB directly. Instead:

```
Agent calls KB → gets knowledge
Agent calls Flow with knowledge as input
```

This keeps the architecture clean and auditable.

### Q: How do we version API contracts?

A: Semantic versioning on services:

```
BolekFlow v1.2.0 → /api/v1/agent/workflows/*
BolekFlow v2.0.0 → /api/v2/agent/workflows/* (breaking change)

BolekAI supports multiple versions if needed
```

---

## 13. Next Steps

1. **Document each service's API** in its own repo
2. **Create HTTP client** in BolekAI for each service
3. **Test integration locally** (docker-compose)
4. **Deploy services** in production
5. **Monitor latency and errors** — adjust timeouts/retries
6. **Add more services** as needed

---

## Document Tree

```
BolekAI/docs/
├── VISION.md                    # Long-term goals
├── MULTI-AGENT-ARCHITECTURE.md # THIS FILE — implementation plan + service network
├── archive/ARCHITECTURE.md     # Superseded target-architecture proposal (see banner)
├── POLUTEK-INTEGRATION.md      # Polutek-specific ops
└── ROADMAP.md                  # Timeline
```
