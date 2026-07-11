import { auditEvent } from './audit'

export type MemoryType = 'profile' | 'project' | 'decision' | 'operational' | 'episodic'
export type MemoryStatus = 'proposed' | 'active' | 'rejected' | 'deleted'
export type MemorySensitivity = 'low' | 'medium' | 'high'

export type MemoryItemRecord = {
  id: string
  memory_type: MemoryType
  status: MemoryStatus
  title: string
  content: string
  redacted_content: string
  source: string
  source_ref: string | null
  confidence: number
  sensitivity: MemorySensitivity
  proposed_by: string
  approved_at: string | null
  rejected_at: string | null
  deleted_at: string | null
  embedding_status: 'not_indexed' | 'queued' | 'indexed' | 'failed'
  embedding_model: string | null
  embedding_ref: string | null
  created_at: string
  updated_at: string
}

export type CreateMemoryProposalInput = {
  memoryType: MemoryType
  title: string
  content: string
  source: string
  sourceRef?: string
  confidence?: number
  sensitivity?: MemorySensitivity
  proposedBy?: string
}

export type UpdateMemoryInput = {
  id: string
  memoryType?: MemoryType
  title?: string
  content?: string
  sensitivity?: MemorySensitivity
  confidence?: number
}

export interface MemoryStorage {
  propose(input: CreateMemoryProposalInput): Promise<MemoryItemRecord>
  list(filter?: { status?: MemoryStatus; memoryType?: MemoryType; limit?: number }): Promise<MemoryItemRecord[]>
  approve(id: string): Promise<boolean>
  reject(id: string): Promise<boolean>
  update(input: UpdateMemoryInput): Promise<boolean>
  delete(id: string): Promise<boolean>
}

const SECRET_PATTERNS: RegExp[] = [
  /\b(?:sk|pk|rk)_[A-Za-z0-9_\-]{12,}\b/g,
  /\bghp_[A-Za-z0-9_]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  /\b(?:password|hasło|haslo|token|secret|api[_-]?key)\b[^\n:=]{0,25}[:=]\s*[^\s,;.!?]+/gi,
]

export function redactMemoryContent(content: string): string {
  return SECRET_PATTERNS.reduce((redacted, pattern) => redacted.replace(pattern, '[REDACTED]'), content)
}

function clampConfidence(confidence: number | undefined): number {
  if (confidence === undefined || !Number.isFinite(confidence)) return 0.7
  return Math.max(0, Math.min(1, confidence))
}

export class D1MemoryStore implements MemoryStorage {
  constructor(private readonly db: D1Database) {}

  async propose(input: CreateMemoryProposalInput): Promise<MemoryItemRecord> {
    const id = crypto.randomUUID()
    const redactedContent = redactMemoryContent(input.content)

    await this.db.prepare(`
      INSERT INTO memory_items (
        id, memory_type, status, title, content, redacted_content, source, source_ref,
        confidence, sensitivity, proposed_by, embedding_status, created_at, updated_at
      ) VALUES (?, ?, 'proposed', ?, ?, ?, ?, ?, ?, ?, ?, 'not_indexed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)
      .bind(
        id,
        input.memoryType,
        input.title,
        redactedContent,
        redactedContent,
        input.source,
        input.sourceRef ?? null,
        clampConfidence(input.confidence),
        input.sensitivity ?? 'medium',
        input.proposedBy ?? 'agent'
      )
      .run()

    const item = await this.get(id)
    if (!item) throw new Error(`Memory item ${id} was not persisted`)
    await auditEvent(this.db, {
      eventType: 'memory_written',
      status: 'proposed',
      data: { memoryId: id, memoryType: item.memory_type, source: item.source },
    })
    return item
  }

  async get(id: string): Promise<MemoryItemRecord | null> {
    return await this.db.prepare('SELECT * FROM memory_items WHERE id = ?').bind(id).first<MemoryItemRecord>()
  }

  async list(filter: { status?: MemoryStatus; memoryType?: MemoryType; limit?: number } = {}): Promise<MemoryItemRecord[]> {
    const status = filter.status ?? 'active'
    const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100)

    if (filter.memoryType) {
      const result = await this.db
        .prepare('SELECT * FROM memory_items WHERE status = ? AND memory_type = ? ORDER BY updated_at DESC LIMIT ?')
        .bind(status, filter.memoryType, limit)
        .all<MemoryItemRecord>()
      return result.results ?? []
    }

    const result = await this.db
      .prepare('SELECT * FROM memory_items WHERE status = ? ORDER BY updated_at DESC LIMIT ?')
      .bind(status, limit)
      .all<MemoryItemRecord>()
    return result.results ?? []
  }

  async approve(id: string): Promise<boolean> {
    const result = await this.db
      .prepare(`UPDATE memory_items SET status = 'active', approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'proposed'`)
      .bind(id)
      .run()
    const changed = Boolean(result.meta.changes)
    if (changed) await auditEvent(this.db, { eventType: 'memory_changed', status: 'active', data: { memoryId: id } })
    return changed
  }

  async reject(id: string): Promise<boolean> {
    const result = await this.db
      .prepare(`UPDATE memory_items SET status = 'rejected', rejected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'proposed'`)
      .bind(id)
      .run()
    const changed = Boolean(result.meta.changes)
    if (changed) await auditEvent(this.db, { eventType: 'memory_changed', status: 'rejected', data: { memoryId: id } })
    return changed
  }

  async update(input: UpdateMemoryInput): Promise<boolean> {
    const existing = await this.get(input.id)
    if (!existing || existing.status === 'deleted') return false

    const content = input.content === undefined ? existing.redacted_content : redactMemoryContent(input.content)
    const result = await this.db.prepare(`
      UPDATE memory_items
      SET memory_type = ?, title = ?, content = ?, redacted_content = ?, sensitivity = ?, confidence = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status != 'deleted'
    `)
      .bind(
        input.memoryType ?? existing.memory_type,
        input.title ?? existing.title,
        content,
        content,
        input.sensitivity ?? existing.sensitivity,
        clampConfidence(input.confidence ?? existing.confidence),
        input.id
      )
      .run()
    const changed = Boolean(result.meta.changes)
    if (changed) await auditEvent(this.db, { eventType: 'memory_changed', status: 'updated', data: { memoryId: input.id } })
    return changed
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .prepare(`UPDATE memory_items SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'deleted'`)
      .bind(id)
      .run()
    const changed = Boolean(result.meta.changes)
    if (changed) await auditEvent(this.db, { eventType: 'memory_changed', status: 'deleted', data: { memoryId: id } })
    return changed
  }
}
