import type { RiskLevel } from './security/types'

export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'executed' | 'failed'

export type ApprovalRecord = {
  id: string
  chat_id: number
  tool_name: string
  risk_level: RiskLevel
  normalized_args: string
  preview: string
  impact: string
  status: ApprovalStatus
  idempotency_key: string
  result: string | null
  error: string | null
  expires_at: string
  created_at: string
  updated_at: string
  approved_at: string | null
  denied_at: string | null
  executed_at: string | null
  failed_at: string | null
}

export type CreateApprovalInput = {
  chatId: number
  toolName: string
  riskLevel: RiskLevel
  normalizedArgs: unknown
  preview: string
  impact: string
  ttlMs?: number
}

export const DEFAULT_APPROVAL_TTL_MS = 15 * 60 * 1000

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
    .join(',')}}`
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function buildApprovalIdempotencyKey(input: Pick<CreateApprovalInput, 'chatId' | 'toolName' | 'normalizedArgs'> & { approvalId: string }): Promise<string> {
  return sha256Hex(`${input.approvalId}:${input.chatId}:${input.toolName}:${stableJson(input.normalizedArgs)}`)
}

export function buildApprovalPreview(toolName: string, normalizedArgs: unknown): string {
  const serialized = JSON.stringify(normalizedArgs ?? {})
  const argsPreview = serialized.length > 900 ? `${serialized.slice(0, 900)}…` : serialized
  return `Tool: ${toolName}\nArgs: ${argsPreview}`
}

export function buildApprovalImpact(toolName: string, riskLevel: RiskLevel, sideEffect: boolean): string {
  if (sideEffect) {
    return `Narzędzie ${toolName} ma riskLevel=${riskLevel} i może zmienić stan zewnętrznego systemu. Wykonanie wymaga jednoznacznego approvala i nastąpi maksymalnie raz.`
  }
  return `Narzędzie ${toolName} ma riskLevel=${riskLevel}. Approval jest wymagany przez policy mimo braku zadeklarowanego side-effectu.`
}

export interface ApprovalStorage {
  create(input: CreateApprovalInput): Promise<ApprovalRecord>
  get(id: string): Promise<ApprovalRecord | null>
  approve(id: string, chatId: number): Promise<boolean>
  deny(id: string, chatId: number): Promise<boolean>
  markExpired(id: string): Promise<void>
  markExecuted(id: string, result: unknown): Promise<boolean>
  markFailed(id: string, error: string): Promise<boolean>
}

export class ApprovalStore implements ApprovalStorage {
  constructor(private readonly db: D1Database) {}

  async create(input: CreateApprovalInput): Promise<ApprovalRecord> {
    const id = crypto.randomUUID()
    const ttlMs = input.ttlMs ?? DEFAULT_APPROVAL_TTL_MS
    const expiresAt = new Date(Date.now() + ttlMs).toISOString()
    const normalizedArgs = JSON.stringify(input.normalizedArgs ?? {})
    const idempotencyKey = await buildApprovalIdempotencyKey({ ...input, approvalId: id })

    await this.db
      .prepare(`
        INSERT INTO approvals (
          id, chat_id, tool_name, risk_level, normalized_args, preview, impact, status,
          idempotency_key, expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `)
      .bind(id, input.chatId, input.toolName, input.riskLevel, normalizedArgs, input.preview, input.impact, idempotencyKey, expiresAt)
      .run()

    const approval = await this.get(id)
    if (!approval) throw new Error(`Approval ${id} was not persisted`)
    return approval
  }

  async get(id: string): Promise<ApprovalRecord | null> {
    return await this.db.prepare('SELECT * FROM approvals WHERE id = ?').bind(id).first<ApprovalRecord>()
  }

  async approve(id: string, chatId: number): Promise<boolean> {
    const result = await this.db
      .prepare(`
        UPDATE approvals
        SET status = 'approved', approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND chat_id = ? AND status = 'pending' AND expires_at > ?
      `)
      .bind(id, chatId, new Date().toISOString())
      .run()
    return Boolean(result.meta.changes)
  }

  async deny(id: string, chatId: number): Promise<boolean> {
    const result = await this.db
      .prepare(`
        UPDATE approvals
        SET status = 'denied', denied_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND chat_id = ? AND status = 'pending'
      `)
      .bind(id, chatId)
      .run()
    return Boolean(result.meta.changes)
  }

  async markExpired(id: string): Promise<void> {
    await this.db
      .prepare(`UPDATE approvals SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`)
      .bind(id)
      .run()
  }

  async markExecuted(id: string, result: unknown): Promise<boolean> {
    const serialized = typeof result === 'string' ? result : JSON.stringify(result)
    const update = await this.db
      .prepare(`
        UPDATE approvals
        SET status = 'executed', result = ?, executed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'approved'
      `)
      .bind(serialized, id)
      .run()
    return Boolean(update.meta.changes)
  }

  async markFailed(id: string, error: string): Promise<boolean> {
    const update = await this.db
      .prepare(`
        UPDATE approvals
        SET status = 'failed', error = ?, failed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'approved'
      `)
      .bind(error, id)
      .run()
    return Boolean(update.meta.changes)
  }
}
