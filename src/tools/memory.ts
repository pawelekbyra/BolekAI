import type { Env } from '../env'
import type { ToolDefinition } from './index'

export const memoryTools: ToolDefinition[] = [
  {
    name: 'memory_remember',
    description:
      'Zapisz trwałą pamięć o właścicielu lub jego życiu — wydarzenie, decyzję, kontekst, preferencję. Używaj gdy pojawia się coś wartego zapamiętania na przyszłość i wyszukania po znaczeniu, nie po sztywnym kluczu.',
    parameters: {
      type: 'object',
      properties: {
        content:  { type: 'string', description: 'Treść pamięci — pełne zdanie, tak jak chciałbyś to sobie przypomnieć' },
        category: { type: 'string', description: 'Opcjonalna kategoria np. "praca", "rodzina", "zdrowie", "finanse"' },
      },
      required: ['content'],
    },
  },
  {
    name: 'memory_recall',
    description:
      'Przypomnij sobie pamięci powiązane znaczeniowo z zapytaniem. Zwraca najtrafniejsze wpisy nawet jeśli użyto innych słów niż przy zapisie.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'O czym chcesz sobie przypomnieć' },
        limit: { type: 'number', description: 'Ile pamięci zwrócić (domyślnie 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_forget',
    description: 'Usuń nieaktualną pamięć po jej id (zwracanym przez memory_recall).',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id pamięci do usunięcia' },
      },
      required: ['id'],
    },
  },
]

const DEFAULT_MODEL = '@cf/baai/bge-m3'
const RECALL_THRESHOLD = 0.4

type EmbeddingResponse = { shape: number[]; data: number[][] }

type MemoryRow = { id: string; content: string; category: string | null; created_at: string }

type RecalledMemory = { id: string; content: string; category: string | null; score: number }

async function embed(env: Env, text: string): Promise<number[]> {
  const model = env.MEMORY_EMBEDDING_MODEL || DEFAULT_MODEL
  const res = (await env.AI.run(model, { text: [text] })) as EmbeddingResponse
  return res.data[0]
}

async function rememberMemory(env: Env, content: string, category?: string): Promise<unknown> {
  const id = crypto.randomUUID()

  await env.DB.prepare(
    'INSERT INTO semantic_memories (id, content, category, source) VALUES (?, ?, ?, ?)'
  )
    .bind(id, content, category ?? null, 'agent')
    .run()

  const values = await embed(env, content)
  await env.MEMORY.upsert([{ id, values, metadata: { category: category ?? '' } }])

  return { ok: true, id }
}

async function recallMemories(env: Env, query: string, limit = 5): Promise<RecalledMemory[]> {
  const vector = await embed(env, query)
  const result = await env.MEMORY.query(vector, { topK: Math.max(1, Math.min(limit, 20)), returnMetadata: true })

  const relevant = result.matches.filter((m) => m.score >= RECALL_THRESHOLD)
  if (!relevant.length) return []

  const ids = relevant.map((m) => m.id)
  const placeholders = ids.map(() => '?').join(', ')
  const rows = await env.DB.prepare(
    `SELECT id, content, category, created_at FROM semantic_memories WHERE id IN (${placeholders})`
  )
    .bind(...ids)
    .all<MemoryRow>()

  const byId = new Map((rows.results ?? []).map((r) => [r.id, r]))

  return relevant
    .map((m) => {
      const row = byId.get(m.id)
      if (!row) return null
      return { id: row.id, content: row.content, category: row.category, score: m.score }
    })
    .filter((m): m is RecalledMemory => m !== null)
}

async function forgetMemory(env: Env, id: string): Promise<unknown> {
  await env.DB.prepare('DELETE FROM semantic_memories WHERE id = ?').bind(id).run()
  await env.MEMORY.deleteByIds([id])
  return { ok: true }
}

export async function executeMemoryTool(name: string, args: unknown, env: Env): Promise<unknown> {
  const a = args as { content?: string; category?: string; query?: string; limit?: number; id?: string }

  switch (name) {
    case 'memory_remember':
      if (!a.content) return { ok: false, error: 'content is required' }
      return rememberMemory(env, a.content, a.category)
    case 'memory_recall':
      if (!a.query) return { ok: false, error: 'query is required' }
      return { memories: await recallMemories(env, a.query, a.limit ?? 5) }
    case 'memory_forget':
      if (!a.id) return { ok: false, error: 'id is required' }
      return forgetMemory(env, a.id)
    default:
      throw new Error(`Unknown memory tool: ${name}`)
  }
}

export async function recallRelevant(env: Env, query: string): Promise<string> {
  try {
    const memories = await recallMemories(env, query, 3)
    if (!memories.length) return ''
    const lines = memories.map((m) => `- ${m.content}`)
    return `\nPowiązane pamięci:\n${lines.join('\n')}`
  } catch {
    return ''
  }
}
