import type { ToolDefinition } from './index'
import { D1MemoryStore, type MemorySensitivity, type MemoryStatus, type MemoryType } from '../memory-items'

export const memoryTools: ToolDefinition[] = [
  {
    name: 'memory_propose',
    riskLevel: 'medium',
    sideEffect: true,
    description: 'Zaproponuj trwałą pamięć do późniejszego zatwierdzenia. Nie zapisuje aktywnej pamięci bez approve.',
    parameters: {
      type: 'object',
      properties: {
        memory_type: { type: 'string', description: 'Typ: profile | project | decision | operational | episodic' },
        title: { type: 'string', description: 'Krótki tytuł pamięci' },
        content: { type: 'string', description: 'Treść pamięci po zredagowaniu sekretów' },
        source: { type: 'string', description: 'Źródło, np. chat, owner_command, document' },
        source_ref: { type: 'string', description: 'Opcjonalny identyfikator źródła' },
        sensitivity: { type: 'string', description: 'low | medium | high' },
        confidence: { type: 'number', description: 'Pewność 0..1' },
      },
      required: ['memory_type', 'title', 'content', 'source'],
    },
  },
  {
    name: 'memory_list',
    riskLevel: 'low',
    sideEffect: false,
    description: 'Wylistuj pamięci według statusu i typu',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'proposed | active | rejected | deleted, domyślnie active' },
        memory_type: { type: 'string', description: 'profile | project | decision | operational | episodic' },
        limit: { type: 'number', description: 'Limit wyników, domyślnie 20' },
      },
    },
  },
  {
    name: 'memory_approve',
    riskLevel: 'medium',
    sideEffect: true,
    description: 'Zatwierdź proponowaną pamięć i uczyń ją aktywną',
    parameters: { type: 'object', properties: { id: { type: 'string', description: 'ID pamięci' } }, required: ['id'] },
  },
  {
    name: 'memory_reject',
    riskLevel: 'medium',
    sideEffect: true,
    description: 'Odrzuć proponowaną pamięć',
    parameters: { type: 'object', properties: { id: { type: 'string', description: 'ID pamięci' } }, required: ['id'] },
  },
  {
    name: 'memory_update',
    riskLevel: 'medium',
    sideEffect: true,
    description: 'Edytuj istniejącą pamięć z redakcją sekretów',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID pamięci' },
        memory_type: { type: 'string', description: 'Nowy typ pamięci' },
        title: { type: 'string', description: 'Nowy tytuł' },
        content: { type: 'string', description: 'Nowa treść' },
        sensitivity: { type: 'string', description: 'low | medium | high' },
        confidence: { type: 'number', description: 'Pewność 0..1' },
      },
      required: ['id'],
    },
  },
  {
    name: 'memory_delete',
    riskLevel: 'medium',
    sideEffect: true,
    description: 'Usuń/dezaktywuj pamięć',
    parameters: { type: 'object', properties: { id: { type: 'string', description: 'ID pamięci' } }, required: ['id'] },
  },
]

type Args = {
  id?: string
  memory_type?: MemoryType
  title?: string
  content?: string
  source?: string
  source_ref?: string
  status?: MemoryStatus
  sensitivity?: MemorySensitivity
  confidence?: number
  limit?: number
}

export async function executeMemoryTool(name: string, args: unknown, db: D1Database): Promise<unknown> {
  const a = args as Args
  const store = new D1MemoryStore(db)

  switch (name) {
    case 'memory_propose': {
      const item = await store.propose({
        memoryType: a.memory_type!,
        title: a.title!,
        content: a.content!,
        source: a.source!,
        sourceRef: a.source_ref,
        confidence: a.confidence,
        sensitivity: a.sensitivity,
      })
      return { ok: true, memory_id: item.id, status: item.status, redacted_content: item.redacted_content }
    }
    case 'memory_list': {
      return await store.list({ status: a.status, memoryType: a.memory_type, limit: a.limit })
    }
    case 'memory_approve': {
      return { ok: await store.approve(a.id!) }
    }
    case 'memory_reject': {
      return { ok: await store.reject(a.id!) }
    }
    case 'memory_update': {
      return { ok: await store.update({ id: a.id!, memoryType: a.memory_type, title: a.title, content: a.content, sensitivity: a.sensitivity, confidence: a.confidence }) }
    }
    case 'memory_delete': {
      return { ok: await store.delete(a.id!) }
    }
    default:
      throw new Error(`Unknown memory tool: ${name}`)
  }
}
