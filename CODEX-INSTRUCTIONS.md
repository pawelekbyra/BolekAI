# CODEX-INSTRUCTIONS.md — Complete Implementation Guide

> Detailed, turn-by-turn instructions for implementing BolekAI.
> This document tells you exactly what to code, in what order, with examples.
> Read DEVELOPMENT.md and CLAUDE.md first for context.

---

## Overview

BolekAI is a personal life automation agent running on Cloudflare Workers. Your job is to build it piece by piece, in phases.

**Current status:** Code skeleton exists (Hono routing, Telegram adapter, orchestrator stub). You're building the actual implementation.

**Your phases (in order):**
1. **Memory System** — D1 database schema + read/write helpers
2. **Tool Handlers** — Implement tasks, notes, and tool registry
3. **External Service Integration** — HTTP clients to Chat, Flow, KB with proper error handling
4. **Testing** — Unit tests for all tools and helpers
5. **Polish & Monitoring** — Logging, error handling, metrics

**Your constraint:** Work on `claude/multi-repo-agent-j3bo9v` branch. Commit after each completed task.

---

## Phase 1: Memory System

### Task 1.1: D1 Schema Update

**What:** Add tables for agent memory (conversations, learned facts, user preferences, task state).

**File:** `src/db/schema.sql`

**Add these tables:**

```sql
-- Conversations: store all chats with user
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_message_at DATETIME,
  summary TEXT,
  tags TEXT, -- JSON array of tags
  FOREIGN KEY (telegram_user_id) REFERENCES users(telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_time 
  ON conversations(telegram_user_id, started_at DESC);

-- Messages: individual messages in conversations
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tokens_used INTEGER,
  tools_called TEXT, -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages(conversation_id, created_at DESC);

-- Learned facts: agent learns about user over time
CREATE TABLE IF NOT EXISTS learned_facts (
  id TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  fact TEXT NOT NULL,
  category TEXT, -- "preference", "schedule", "constraint", "fact"
  confidence REAL DEFAULT 1.0,
  source TEXT, -- "user_stated", "inferred", "memory_proposal_accepted"
  learned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_referenced_at DATETIME,
  FOREIGN KEY (telegram_user_id) REFERENCES users(telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_facts_user_category
  ON learned_facts(telegram_user_id, category);

-- Tasks: created by agent or user, tracked with state
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK(status IN ('open', 'in_progress', 'completed', 'cancelled')),
  priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'critical')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  due_at DATETIME,
  completed_at DATETIME,
  tags TEXT, -- JSON array
  FOREIGN KEY (telegram_user_id) REFERENCES users(telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_status
  ON tasks(telegram_user_id, status, due_at);

-- User: single user (the owner)
CREATE TABLE IF NOT EXISTS users (
  telegram_id TEXT PRIMARY KEY,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME,
  preferences TEXT -- JSON object
);
```

**Test:** Run locally with Wrangler:
```bash
wrangler d1 execute bolekai --local --file=src/db/schema.sql
```
Verify no syntax errors.

**Commit:**
```
feat: add D1 schema for memory (conversations, messages, facts, tasks)
```

---

### Task 1.2: Memory Helpers

**What:** Implement `src/memory.ts` — functions to read/write to D1 without boilerplate.

**File:** `src/memory.ts`

**Code:**

```typescript
import type { D1Database } from '@cloudflare/workers-types'
import type { LearnedFact, Task, Conversation, Message } from './types'

export class Memory {
  constructor(private db: D1Database) {}

  // Conversations
  async createConversation(userId: string, tags: string[] = []): Promise<string> {
    const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    await this.db
      .prepare(
        `INSERT INTO conversations (id, telegram_user_id, tags)
         VALUES (?, ?, ?)`
      )
      .bind(id, userId, JSON.stringify(tags))
      .run()
    return id
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const result = await this.db
      .prepare(`SELECT * FROM conversations WHERE id = ?`)
      .bind(id)
      .first<Conversation>()
    return result || null
  }

  async updateConversationSummary(conversationId: string, summary: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE conversations 
         SET summary = ?, last_message_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(summary, conversationId)
      .run()
  }

  // Messages
  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    tokensUsed?: number,
    toolsCalled?: string[]
  ): Promise<string> {
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    await this.db
      .prepare(
        `INSERT INTO messages (id, conversation_id, role, content, tokens_used, tools_called)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        conversationId,
        role,
        content,
        tokensUsed || null,
        toolsCalled ? JSON.stringify(toolsCalled) : null
      )
      .run()
    return id
  }

  async getConversationHistory(
    conversationId: string,
    limit: number = 50
  ): Promise<Message[]> {
    const results = await this.db
      .prepare(
        `SELECT * FROM messages 
         WHERE conversation_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .bind(conversationId, limit)
      .all<Message>()
    return (results.results || []).reverse()
  }

  // Learned facts
  async learnFact(
    userId: string,
    fact: string,
    category: 'preference' | 'schedule' | 'constraint' | 'fact',
    source: 'user_stated' | 'inferred' | 'memory_proposal_accepted' = 'inferred'
  ): Promise<string> {
    const id = `fact_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    await this.db
      .prepare(
        `INSERT INTO learned_facts (id, telegram_user_id, fact, category, source)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, userId, fact, category, source)
      .run()
    return id
  }

  async getUserFacts(userId: string, category?: string): Promise<LearnedFact[]> {
    let query = `SELECT * FROM learned_facts WHERE telegram_user_id = ?`
    const params: any[] = [userId]

    if (category) {
      query += ` AND category = ?`
      params.push(category)
    }

    query += ` ORDER BY learned_at DESC`

    const results = await this.db.prepare(query).bind(...params).all<LearnedFact>()
    return results.results || []
  }

  async updateFactReference(factId: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE learned_facts 
         SET last_referenced_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(factId)
      .run()
  }

  // Tasks
  async createTask(
    userId: string,
    title: string,
    options: {
      description?: string
      priority?: 'low' | 'medium' | 'high' | 'critical'
      dueAt?: Date
      tags?: string[]
    } = {}
  ): Promise<string> {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    await this.db
      .prepare(
        `INSERT INTO tasks (id, telegram_user_id, title, description, priority, due_at, tags, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`
      )
      .bind(
        id,
        userId,
        title,
        options.description || null,
        options.priority || 'medium',
        options.dueAt ? options.dueAt.toISOString() : null,
        options.tags ? JSON.stringify(options.tags) : null
      )
      .run()
    return id
  }

  async getUserTasks(
    userId: string,
    status?: 'open' | 'in_progress' | 'completed' | 'cancelled'
  ): Promise<Task[]> {
    let query = `SELECT * FROM tasks WHERE telegram_user_id = ?`
    const params: any[] = [userId]

    if (status) {
      query += ` AND status = ?`
      params.push(status)
    }

    query += ` ORDER BY priority DESC, due_at ASC`

    const results = await this.db.prepare(query).bind(...params).all<Task>()
    return results.results || []
  }

  async updateTaskStatus(
    taskId: string,
    status: 'open' | 'in_progress' | 'completed' | 'cancelled'
  ): Promise<void> {
    const completedAt = status === 'completed' ? 'CURRENT_TIMESTAMP' : 'NULL'
    await this.db
      .prepare(
        `UPDATE tasks 
         SET status = ?, completed_at = ${completedAt}
         WHERE id = ?`
      )
      .bind(status, taskId)
      .run()
  }

  // User profile
  async getUserPreferences(userId: string): Promise<Record<string, any>> {
    const user = await this.db
      .prepare(`SELECT preferences FROM users WHERE telegram_id = ?`)
      .bind(userId)
      .first<{ preferences: string | null }>()

    if (!user?.preferences) return {}
    return JSON.parse(user.preferences)
  }

  async updateUserPreferences(userId: string, prefs: Record<string, any>): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO users (telegram_id, preferences) VALUES (?, ?)
         ON CONFLICT(telegram_id) DO UPDATE SET preferences = ?`
      )
      .bind(userId, JSON.stringify(prefs), JSON.stringify(prefs))
      .run()
  }
}
```

**File:** `src/types.ts` (add these types if not exist)

```typescript
export interface Conversation {
  id: string
  telegram_user_id: string
  started_at: string
  last_message_at: string | null
  summary: string | null
  tags: string // JSON
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  tokens_used: number | null
  tools_called: string | null // JSON
  created_at: string
}

export interface LearnedFact {
  id: string
  telegram_user_id: string
  fact: string
  category: 'preference' | 'schedule' | 'constraint' | 'fact'
  confidence: number
  source: 'user_stated' | 'inferred' | 'memory_proposal_accepted'
  learned_at: string
  last_referenced_at: string | null
}

export interface Task {
  id: string
  telegram_user_id: string
  title: string
  description: string | null
  status: 'open' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'critical'
  created_at: string
  due_at: string | null
  completed_at: string | null
  tags: string | null // JSON
}

export interface User {
  telegram_id: string
  name: string | null
  created_at: string
  last_seen_at: string | null
  preferences: string | null // JSON
}
```

**Test:** Create `src/__tests__/memory.test.ts`

```typescript
import { Memory } from '../memory'

describe('Memory', () => {
  let memory: Memory
  let db: any // Mock D1Database in real tests

  beforeEach(() => {
    // In real test, use D1 test helper
    memory = new Memory(db)
  })

  it('should create conversation', async () => {
    const id = await memory.createConversation('user123', ['greeting'])
    expect(id).toMatch(/^conv_/)
  })

  it('should add messages to conversation', async () => {
    const convId = await memory.createConversation('user123')
    const msgId = await memory.addMessage(convId, 'user', 'Hello')
    expect(msgId).toMatch(/^msg_/)
  })

  it('should learn facts', async () => {
    const factId = await memory.learnFact('user123', 'Prefers mornings', 'preference')
    expect(factId).toMatch(/^fact_/)
  })

  it('should create tasks', async () => {
    const taskId = await memory.createTask('user123', 'Buy milk', {
      priority: 'high',
      tags: ['shopping']
    })
    expect(taskId).toMatch(/^task_/)
  })
})
```

**Commit:**
```
feat: implement Memory helper class for D1 operations

- Add CRUD operations for conversations, messages, learned facts, tasks
- Helper methods for common queries (get user facts, get open tasks, etc.)
- Type-safe operations with proper JSON serialization
- Includes unit test structure
```

---

## Phase 2: Tool Handlers

### Task 2.1: Tool Type System

**What:** Define the tool interface so all tools are consistent.

**File:** `src/tools/types.ts`

```typescript
export interface ToolInput {
  [key: string]: string | number | boolean | string[] | null | undefined
}

export interface ToolOutput {
  success: boolean
  message: string
  data?: Record<string, any>
  error?: string
}

export interface ToolDefinition {
  name: string
  description: string
  category: 'task' | 'note' | 'memory' | 'query' | 'action' | 'external'
  parameters: Record<string, ParameterDefinition>
  handler: (input: ToolInput, context: ToolContext) => Promise<ToolOutput>
}

export interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'array'
  description: string
  required: boolean
  enum?: string[]
}

export interface ToolContext {
  userId: string
  memory: Memory
  conversationId: string
  externalServices: ExternalServices
  logger: Logger
}

export interface ExternalServices {
  chat?: ChatServiceClient
  flow?: FlowServiceClient
  kb?: KBServiceClient
}
```

**Commit:**
```
feat: define tool interface and types for consistency
```

---

### Task 2.2: Task Tool Handler

**What:** Implement the tasks tool — create, list, update, complete tasks.

**File:** `src/tools/tasks.ts`

```typescript
import type { ToolDefinition, ToolContext, ToolInput, ToolOutput } from './types'

export const tasksTool: ToolDefinition = {
  name: 'tasks',
  description: 'Create, list, and manage tasks',
  category: 'task',
  parameters: {
    action: {
      type: 'string',
      description: 'Action to perform: create, list, complete, cancel',
      required: true,
      enum: ['create', 'list', 'complete', 'cancel']
    },
    title: {
      type: 'string',
      description: 'Task title (required for create)',
      required: false
    },
    priority: {
      type: 'string',
      description: 'Priority: low, medium, high, critical',
      required: false,
      enum: ['low', 'medium', 'high', 'critical']
    },
    dueDate: {
      type: 'string',
      description: 'Due date in ISO format (YYYY-MM-DD)',
      required: false
    },
    taskId: {
      type: 'string',
      description: 'Task ID (for complete/cancel)',
      required: false
    },
    status: {
      type: 'string',
      description: 'Filter by status',
      required: false,
      enum: ['open', 'in_progress', 'completed', 'cancelled']
    }
  },
  handler: async (input: ToolInput, context: ToolContext): Promise<ToolOutput> => {
    const action = String(input.action)

    try {
      switch (action) {
        case 'create': {
          if (!input.title) {
            return {
              success: false,
              message: 'Title is required to create task',
              error: 'MISSING_TITLE'
            }
          }

          const taskId = await context.memory.createTask(context.userId, String(input.title), {
            priority: (input.priority as any) || 'medium',
            dueAt: input.dueDate ? new Date(String(input.dueDate)) : undefined,
            tags: []
          })

          context.logger.info('Task created', { taskId, title: input.title })

          return {
            success: true,
            message: `Task "${input.title}" created`,
            data: { taskId }
          }
        }

        case 'list': {
          const tasks = await context.memory.getUserTasks(context.userId, input.status as any)

          return {
            success: true,
            message: `Found ${tasks.length} task(s)`,
            data: { tasks }
          }
        }

        case 'complete': {
          if (!input.taskId) {
            return {
              success: false,
              message: 'Task ID is required',
              error: 'MISSING_TASK_ID'
            }
          }

          await context.memory.updateTaskStatus(String(input.taskId), 'completed')
          context.logger.info('Task completed', { taskId: input.taskId })

          return {
            success: true,
            message: 'Task marked as completed'
          }
        }

        case 'cancel': {
          if (!input.taskId) {
            return {
              success: false,
              message: 'Task ID is required',
              error: 'MISSING_TASK_ID'
            }
          }

          await context.memory.updateTaskStatus(String(input.taskId), 'cancelled')
          context.logger.info('Task cancelled', { taskId: input.taskId })

          return {
            success: true,
            message: 'Task cancelled'
          }
        }

        default:
          return {
            success: false,
            message: `Unknown action: ${action}`,
            error: 'UNKNOWN_ACTION'
          }
      }
    } catch (err) {
      context.logger.error('Task tool error', { action, error: String(err) })
      return {
        success: false,
        message: 'Failed to process task',
        error: 'INTERNAL_ERROR'
      }
    }
  }
}
```

**Test:** `src/tools/__tests__/tasks.test.ts`

```typescript
import { tasksTool } from '../tasks'

describe('tasksTool', () => {
  let mockContext: any

  beforeEach(() => {
    mockContext = {
      userId: 'user123',
      memory: {
        createTask: jest.fn().mockResolvedValue('task_123'),
        getUserTasks: jest.fn().mockResolvedValue([
          { id: 'task_123', title: 'Test task', status: 'open' }
        ]),
        updateTaskStatus: jest.fn().mockResolvedValue(void 0)
      },
      logger: { info: jest.fn(), error: jest.fn() },
      conversationId: 'conv_123'
    }
  })

  it('should create task', async () => {
    const result = await tasksTool.handler(
      { action: 'create', title: 'Buy milk', priority: 'high' },
      mockContext
    )
    expect(result.success).toBe(true)
    expect(mockContext.memory.createTask).toHaveBeenCalledWith(
      'user123',
      'Buy milk',
      expect.objectContaining({ priority: 'high' })
    )
  })

  it('should list tasks', async () => {
    const result = await tasksTool.handler({ action: 'list' }, mockContext)
    expect(result.success).toBe(true)
    expect(result.data?.tasks).toHaveLength(1)
  })

  it('should complete task', async () => {
    const result = await tasksTool.handler(
      { action: 'complete', taskId: 'task_123' },
      mockContext
    )
    expect(result.success).toBe(true)
    expect(mockContext.memory.updateTaskStatus).toHaveBeenCalledWith('task_123', 'completed')
  })
})
```

**Commit:**
```
feat: implement tasks tool handler (create, list, complete, cancel)
```

---

### Task 2.3: Knowledge Tool Handler

**What:** Implement tool for learning facts and querying knowledge.

**File:** `src/tools/knowledge.ts`

```typescript
import type { ToolDefinition, ToolContext, ToolInput, ToolOutput } from './types'

export const knowledgeTool: ToolDefinition = {
  name: 'knowledge',
  description: 'Learn and recall facts about the user',
  category: 'memory',
  parameters: {
    action: {
      type: 'string',
      description: 'Action: learn, recall, or list',
      required: true,
      enum: ['learn', 'recall', 'list']
    },
    fact: {
      type: 'string',
      description: 'Fact to learn (for learn action)',
      required: false
    },
    category: {
      type: 'string',
      description: 'Category: preference, schedule, constraint, or fact',
      required: false,
      enum: ['preference', 'schedule', 'constraint', 'fact']
    },
    source: {
      type: 'string',
      description: 'How was this learned: user_stated, inferred, memory_proposal_accepted',
      required: false
    }
  },
  handler: async (input: ToolInput, context: ToolContext): Promise<ToolOutput> => {
    const action = String(input.action)

    try {
      switch (action) {
        case 'learn': {
          if (!input.fact) {
            return {
              success: false,
              message: 'Fact is required to learn',
              error: 'MISSING_FACT'
            }
          }

          const factId = await context.memory.learnFact(
            context.userId,
            String(input.fact),
            (input.category as any) || 'fact',
            (input.source as any) || 'inferred'
          )

          context.logger.info('Fact learned', { factId, category: input.category })

          return {
            success: true,
            message: `Learned: ${input.fact}`,
            data: { factId }
          }
        }

        case 'recall': {
          const category = input.category ? String(input.category) : undefined
          const facts = await context.memory.getUserFacts(context.userId, category)

          // Update last_referenced_at for each
          for (const fact of facts) {
            await context.memory.updateFactReference(fact.id)
          }

          return {
            success: true,
            message: `Recalled ${facts.length} fact(s)`,
            data: { facts }
          }
        }

        case 'list': {
          const facts = await context.memory.getUserFacts(context.userId)
          const byCategory = facts.reduce((acc, fact) => {
            if (!acc[fact.category]) acc[fact.category] = []
            acc[fact.category].push(fact)
            return acc
          }, {} as Record<string, any[]>)

          return {
            success: true,
            message: `User has ${facts.length} learned fact(s)`,
            data: { byCategory, total: facts.length }
          }
        }

        default:
          return {
            success: false,
            message: `Unknown action: ${action}`,
            error: 'UNKNOWN_ACTION'
          }
      }
    } catch (err) {
      context.logger.error('Knowledge tool error', { action, error: String(err) })
      return {
        success: false,
        message: 'Failed to process knowledge',
        error: 'INTERNAL_ERROR'
      }
    }
  }
}
```

**Commit:**
```
feat: implement knowledge tool handler (learn, recall, list facts)
```

---

### Task 2.4: Tool Registry & Dispatcher

**What:** Update `src/tools/index.ts` to register all tools and implement dispatcher.

**File:** `src/tools/index.ts`

```typescript
import { tasksTool } from './tasks'
import { knowledgeTool } from './knowledge'
import type { ToolDefinition, ToolContext } from './types'

const builtInTools: ToolDefinition[] = [tasksTool, knowledgeTool]

export const toolRegistry = new Map<string, ToolDefinition>(
  builtInTools.map((tool) => [tool.name, tool])
)

export async function executeBuiltInTool(
  toolName: string,
  input: Record<string, any>,
  context: ToolContext
): Promise<any> {
  const tool = toolRegistry.get(toolName)

  if (!tool) {
    return {
      success: false,
      message: `Tool not found: ${toolName}`,
      error: 'TOOL_NOT_FOUND'
    }
  }

  try {
    return await tool.handler(input, context)
  } catch (err) {
    context.logger.error('Tool execution failed', { tool: toolName, error: String(err) })
    return {
      success: false,
      message: `Tool execution failed: ${toolName}`,
      error: 'EXECUTION_ERROR'
    }
  }
}

export function listAvailableTools(): Array<{
  name: string
  description: string
  category: string
}> {
  return builtInTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    category: tool.category
  }))
}

export { type ToolDefinition, type ToolContext } from './types'
```

**Commit:**
```
feat: implement tool registry and dispatcher

- Central registry of all available tools
- executeBuiltInTool dispatches to correct handler
- listAvailableTools for discovery
```

---

## Phase 3: External Service Integration

### Task 3.1: Robust HTTP Clients

**What:** Update `src/tools/external/` clients with proper error handling, retry logic, timeout.

**File:** `src/tools/external/http-client.ts` (new helper)

```typescript
interface HTTPConfig {
  baseURL: string
  token: string
  timeout?: number
  maxRetries?: number
}

interface HTTPResponse<T> {
  ok: boolean
  status: number
  data?: T
  error?: {
    code: string
    message: string
  }
}

export class HTTPClient {
  private config: HTTPConfig

  constructor(config: HTTPConfig) {
    this.config = {
      timeout: 10000,
      maxRetries: 2,
      ...config
    }
  }

  async post<T = any>(
    path: string,
    body: Record<string, any>
  ): Promise<HTTPResponse<T>> {
    return this._request<T>('POST', path, body)
  }

  async get<T = any>(path: string): Promise<HTTPResponse<T>> {
    return this._request<T>('GET', path)
  }

  private async _request<T = any>(
    method: string,
    path: string,
    body?: Record<string, any>
  ): Promise<HTTPResponse<T>> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.config.maxRetries!; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

        const response = await fetch(`${this.config.baseURL}${path}`, {
          method,
          headers: {
            'Authorization': `Bearer ${this.config.token}`,
            'Content-Type': 'application/json'
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          return {
            ok: false,
            status: response.status,
            error: {
              code: errorData.error?.code || 'HTTP_ERROR',
              message: errorData.error?.message || response.statusText
            }
          }
        }

        const data = await response.json()
        return { ok: true, status: 200, data }
      } catch (err) {
        lastError = err as Error

        // Don't retry on auth errors
        if (lastError.message.includes('401')) {
          return {
            ok: false,
            status: 401,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Invalid or expired token'
            }
          }
        }

        // Retry on timeout or network errors
        if (attempt < this.config.maxRetries!) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          )
        }
      }
    }

    return {
      ok: false,
      status: 0,
      error: {
        code: 'REQUEST_FAILED',
        message: lastError?.message || 'Request failed after retries'
      }
    }
  }
}
```

**File:** `src/tools/external/flow-service.ts` (update with HTTP client)

```typescript
import { HTTPClient } from './http-client'
import type { ToolContext, ToolOutput } from '../types'

export class FlowServiceClient {
  private http: HTTPClient

  constructor(baseURL: string, token: string) {
    this.http = new HTTPClient({ baseURL, token })
  }

  async executeWorkflow(
    workflowId: string,
    inputs: Record<string, any>
  ): Promise<ToolOutput> {
    const response = await this.http.post('/api/agent/workflows/execute', {
      workflowId,
      inputs
    })

    if (!response.ok) {
      return {
        success: false,
        message: `Workflow execution failed: ${response.error?.message}`,
        error: response.error?.code
      }
    }

    return {
      success: true,
      message: 'Workflow executed',
      data: response.data
    }
  }

  async getWorkflowStatus(
    workflowId: string,
    runId: string
  ): Promise<ToolOutput> {
    const response = await this.http.get(`/api/agent/workflows/${workflowId}/status/${runId}`)

    if (!response.ok) {
      return {
        success: false,
        message: `Failed to get status: ${response.error?.message}`,
        error: response.error?.code
      }
    }

    return {
      success: true,
      message: 'Status retrieved',
      data: response.data
    }
  }

  async listWorkflows(): Promise<ToolOutput> {
    const response = await this.http.get('/api/agent/workflows/list')

    if (!response.ok) {
      return {
        success: false,
        message: `Failed to list workflows: ${response.error?.message}`,
        error: response.error?.code
      }
    }

    return {
      success: true,
      message: 'Workflows listed',
      data: response.data
    }
  }
}

// Similar pattern for KnowledgeServiceClient and ChatServiceClient
```

**Commit:**
```
feat: implement robust HTTP client with retry and timeout logic

- HTTPClient base class for all external service calls
- Exponential backoff retry on network errors
- Request timeout with abort controller
- Proper error handling and response typing
- Use in Flow, KB, and Chat service clients
```

---

## Phase 4: Testing

### Task 4.1: Unit Tests for All Tools

**What:** Add comprehensive unit tests.

**Run:** From BolekAI root:
```bash
npm test -- src/tools/__tests__/
```

All tests must pass.

**Commit per test file** as you write them.

---

## Phase 5: Integration & Polish

### Task 5.1: Orchestrator Tool Dispatch

**What:** Update `src/orchestrator.ts` to use tool dispatcher.

Make sure when AI calls a tool, it goes through:
1. `executeBuiltInTool()` for built-in tools (tasks, knowledge)
2. External service clients for external tools (flow_*, kb_*, chat_*)

**Commit:**
```
feat: integrate tool dispatcher into orchestrator
```

### Task 5.2: Logging & Error Handling

**What:** Add structured logging to all functions. Every error should be catchable and loggable.

**File:** `src/logger.ts`

```typescript
interface LogContext {
  [key: string]: any
}

export class Logger {
  private service: string

  constructor(service: string) {
    this.service = service
  }

  info(message: string, context?: LogContext) {
    console.log(JSON.stringify({ level: 'info', service: this.service, message, ...context }))
  }

  error(message: string, context?: LogContext) {
    console.error(JSON.stringify({ level: 'error', service: this.service, message, ...context }))
  }

  warn(message: string, context?: LogContext) {
    console.warn(JSON.stringify({ level: 'warn', service: this.service, message, ...context }))
  }
}
```

**Commit:**
```
feat: add structured logging throughout codebase
```

---

## How to Proceed

1. **Start with Phase 1, Task 1.1** — D1 schema
2. **After each task, commit** with the commit message provided
3. **Test locally** before moving to next task
4. **If stuck:**
   - Read error message carefully
   - Check types in `src/types.ts`
   - Look at similar code in existing files
   - Ask yourself: "What does this function need as input and what should it return?"

5. **When done with a phase, test entire phase:**
   ```bash
   npm test -- src/tools/__tests__/
   npm run build  # TypeScript check
   ```

---

## Success Criteria

By the end, BolekAI should:

- ✅ Have D1 schema with memory tables
- ✅ Have Memory class with all CRUD operations
- ✅ Have tasks and knowledge tools implemented
- ✅ Have tool registry and dispatcher
- ✅ Have robust HTTP clients for external services
- ✅ Have comprehensive unit tests (>80% coverage)
- ✅ Have logging throughout
- ✅ Build successfully with `npm run build`
- ✅ All code is TypeScript, no `any` types

---

## Questions & Troubleshooting

**Q: What if D1 test fails?**
A: Use Wrangler CLI: `wrangler d1 execute bolekai --local --file=src/db/schema.sql`

**Q: Do I need to implement all tools?**
A: Start with tasks and knowledge. Others (notes, reminders) follow same pattern.

**Q: Should I write tests first (TDD)?**
A: No. Write code, then test. Makes it faster to iterate.

**Q: When should I commit?**
A: After every completed task (every section in PHASES above).

---

## Links

- [DEVELOPMENT.md](DEVELOPMENT.md) — Development guide
- [PROJECT_STATUS.md](PROJECT_STATUS.md) — Current phase tracking
- [CLAUDE.md](CLAUDE.md) — Architecture and philosophy
