import type { RiskLevel } from './security/types'

export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'executed' | 'failed'

export type Approval = {
  id: string
  chatId: number
  toolName: string
  riskLevel: RiskLevel
  normalizedArgs: unknown
  preview: string
  impact: string
  status: ApprovalStatus
  idempotencyKey: string
  expiresAt: string
  createdAt: string
  updatedAt: string
  decidedAt?: string
  executedAt?: string
  failureReason?: string
}

export type CreateApprovalInput = {
  id?: string
  chatId: number
  toolName: string
  riskLevel: RiskLevel
  normalizedArgs: unknown
  preview: string
  impact: string
  idempotencyKey: string
  expiresAt: string
}

export interface ApprovalStore {
  create(input: CreateApprovalInput): Promise<Approval>
  get(id: string): Promise<Approval | null>
  approve(id: string): Promise<Approval | null>
  deny(id: string): Promise<Approval | null>
  markExecuted(id: string): Promise<Approval | null>
  markFailed(id: string, reason: string): Promise<Approval | null>
}

type ApprovalRow = {
  id: string
  chat_id: number
  tool_name: string
  risk_level: RiskLevel
  normalized_args: string
  preview: string
  impact: string
  status: ApprovalStatus
  idempotency_key: string
  expires_at: string
  created_at: string
  updated_at: string
  decided_at: string | null
  executed_at: string | null
  failure_reason: string | null
}

function generateApprovalId(): string {
  return `appr_${crypto.randomUUID()}`
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function toApproval(row: ApprovalRow): Approval {
  return {
    id: row.id,
    chatId: row.chat_id,
    toolName: row.tool_name,
    riskLevel: row.risk_level,
    normalizedArgs: parseJson(row.normalized_args),
    preview: row.preview,
    impact: row.impact,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    decidedAt: row.decided_at ?? undefined,
    executedAt: row.executed_at ?? undefined,
    failureReason: row.failure_reason ?? undefined,
  }
}

export class D1ApprovalStore implements ApprovalStore {
  constructor(private readonly db: D1Database) {}

  async create(input: CreateApprovalInput): Promise<Approval> {
    const id = input.id ?? generateApprovalId()

    await this.db
      .prepare(`
        INSERT INTO approvals (
          id,
          chat_id,
          tool_name,
          risk_level,
          normalized_args,
          preview,
          impact,
          status,
          idempotency_key,
          expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `)
      .bind(
        id,
        input.chatId,
        input.toolName,
        input.riskLevel,
        JSON.stringify(input.normalizedArgs ?? {}),
        input.preview,
        input.impact,
        input.idempotencyKey,
        input.expiresAt,
      )
      .run()

    const approval = await this.get(id)
    if (!approval) {
      throw new Error(`Approval ${id} was not found after create`)
    }

    return approval
  }

  async get(id: string): Promise<Approval | null> {
    const row = await this.db
      .prepare(`
        SELECT
          id,
          chat_id,
          tool_name,
          risk_level,
          normalized_args,
          preview,
          impact,
          status,
          idempotency_key,
          expires_at,
          created_at,
          updated_at,
          decided_at,
          executed_at,
          failure_reason
        FROM approvals
        WHERE id = ?
      `)
      .bind(id)
      .first<ApprovalRow>()

    return row ? toApproval(row) : null
  }

  async approve(id: string): Promise<Approval | null> {
    await this.db
      .prepare(`
        UPDATE approvals
        SET status = 'approved', updated_at = CURRENT_TIMESTAMP, decided_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP
      `)
      .bind(id)
      .run()

    return this.get(id)
  }

  async deny(id: string): Promise<Approval | null> {
    await this.db
      .prepare(`
        UPDATE approvals
        SET status = 'denied', updated_at = CURRENT_TIMESTAMP, decided_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending'
      `)
      .bind(id)
      .run()

    return this.get(id)
  }

  async markExecuted(id: string): Promise<Approval | null> {
    await this.db
      .prepare(`
        UPDATE approvals
        SET status = 'executed', updated_at = CURRENT_TIMESTAMP, executed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'approved'
      `)
      .bind(id)
      .run()

    return this.get(id)
  }

  async markFailed(id: string, reason: string): Promise<Approval | null> {
    await this.db
      .prepare(`
        UPDATE approvals
        SET status = 'failed', updated_at = CURRENT_TIMESTAMP, failure_reason = ?
        WHERE id = ? AND status IN ('approved', 'executed')
      `)
      .bind(reason, id)
      .run()

    return this.get(id)
  }
}
