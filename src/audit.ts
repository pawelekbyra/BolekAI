import type { RiskLevel } from './security/types'

export type AuditEventType =
  | 'policy_decision'
  | 'side_effect_blocked'
  | 'approval_created'
  | 'approval_approved'
  | 'approval_denied'
  | 'approval_expired'
  | 'approval_executed'
  | 'approval_failed'
  | 'tool_executed'
  | 'tool_failed'

export type AuditEventInput = {
  chatId?: number
  eventType: AuditEventType
  toolName?: string
  riskLevel?: RiskLevel
  policyDecision?: string
  approvalId?: string
  status?: string
  data?: unknown
}

function safeSerialize(value: unknown): string | null {
  if (value === undefined) return null

  try {
    return JSON.stringify(value)
  } catch (err) {
    return JSON.stringify({
      serializationError: err instanceof Error ? err.message : String(err),
    })
  }
}

export interface AuditEventStorage {
  write(input: AuditEventInput): Promise<void>
}

export class D1AuditEventStore implements AuditEventStorage {
  constructor(private readonly db: D1Database) {}

  async write(input: AuditEventInput): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO audit_events (
          id, chat_id, event_type, tool_name, risk_level, policy_decision,
          approval_id, status, data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(
        crypto.randomUUID(),
        input.chatId ?? null,
        input.eventType,
        input.toolName ?? null,
        input.riskLevel ?? null,
        input.policyDecision ?? null,
        input.approvalId ?? null,
        input.status ?? null,
        safeSerialize(input.data)
      )
      .run()
  }
}

export async function auditEvent(db: D1Database | undefined, input: AuditEventInput): Promise<void> {
  if (!db) return

  try {
    await new D1AuditEventStore(db).write(input)
  } catch (err) {
    console.warn('[audit] failed to write audit event', {
      eventType: input.eventType,
      toolName: input.toolName,
      approvalId: input.approvalId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
