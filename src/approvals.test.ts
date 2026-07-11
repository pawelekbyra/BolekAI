import { describe, expect, it } from 'vitest'
import { D1ApprovalStore, type ApprovalStatus } from './approvals'
import type { RiskLevel } from './security/types'

type StoredApprovalRow = {
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

class FakeD1PreparedStatement {
  private bindings: unknown[] = []

  constructor(
    private readonly rows: Map<string, StoredApprovalRow>,
    private readonly query: string,
  ) {}

  bind(...values: unknown[]): FakeD1PreparedStatement {
    this.bindings = values
    return this
  }

  async run(): Promise<unknown> {
    const normalizedQuery = this.query.replace(/\s+/g, ' ').trim()
    const now = '2026-07-11 12:00:00'

    if (normalizedQuery.startsWith('INSERT INTO approvals')) {
      const [id, chatId, toolName, riskLevel, normalizedArgs, preview, impact, idempotencyKey, expiresAt] = this.bindings
      this.rows.set(String(id), {
        id: String(id),
        chat_id: Number(chatId),
        tool_name: String(toolName),
        risk_level: riskLevel as RiskLevel,
        normalized_args: String(normalizedArgs),
        preview: String(preview),
        impact: String(impact),
        status: 'pending',
        idempotency_key: String(idempotencyKey),
        expires_at: String(expiresAt),
        created_at: now,
        updated_at: now,
        decided_at: null,
        executed_at: null,
        failure_reason: null,
      })
      return {}
    }

    if (normalizedQuery.includes("SET status = 'approved'")) {
      const id = String(this.bindings[0])
      const row = this.rows.get(id)
      if (row?.status === 'pending' && row.expires_at > now) {
        row.status = 'approved'
        row.updated_at = now
        row.decided_at = now
      }
      return {}
    }

    if (normalizedQuery.includes("SET status = 'denied'")) {
      const id = String(this.bindings[0])
      const row = this.rows.get(id)
      if (row?.status === 'pending') {
        row.status = 'denied'
        row.updated_at = now
        row.decided_at = now
      }
      return {}
    }

    if (normalizedQuery.includes("SET status = 'executed'")) {
      const id = String(this.bindings[0])
      const row = this.rows.get(id)
      if (row?.status === 'approved') {
        row.status = 'executed'
        row.updated_at = now
        row.executed_at = now
      }
      return {}
    }

    if (normalizedQuery.includes("SET status = 'failed'")) {
      const [reason, id] = this.bindings
      const row = this.rows.get(String(id))
      if (row?.status === 'approved' || row?.status === 'executed') {
        row.status = 'failed'
        row.updated_at = now
        row.failure_reason = String(reason)
      }
      return {}
    }

    throw new Error(`Unexpected query: ${normalizedQuery}`)
  }

  async first<T>(): Promise<T | null> {
    const id = String(this.bindings[0])
    return (this.rows.get(id) as T | undefined) ?? null
  }
}

class FakeD1Database {
  readonly rows = new Map<string, StoredApprovalRow>()

  prepare(query: string): FakeD1PreparedStatement {
    return new FakeD1PreparedStatement(this.rows, query)
  }
}

function createStore(): D1ApprovalStore {
  return new D1ApprovalStore(new FakeD1Database() as unknown as D1Database)
}

describe('D1ApprovalStore', () => {
  it('creates and reads an approval with normalized args parsed from JSON', async () => {
    const store = createStore()

    const approval = await store.create({
      id: 'appr_test',
      chatId: 123,
      toolName: 'stripe_refund',
      riskLevel: 'critical',
      normalizedArgs: { paymentId: 'pi_123' },
      preview: 'Refund payment pi_123',
      impact: 'Moves money back to customer',
      idempotencyKey: 'stripe_refund:pi_123',
      expiresAt: '2026-07-11 13:00:00',
    })

    expect(approval).toMatchObject({
      id: 'appr_test',
      chatId: 123,
      toolName: 'stripe_refund',
      riskLevel: 'critical',
      normalizedArgs: { paymentId: 'pi_123' },
      status: 'pending',
      idempotencyKey: 'stripe_refund:pi_123',
    })
  })

  it('supports approve, execute and fail lifecycle updates', async () => {
    const store = createStore()
    await store.create({
      id: 'appr_lifecycle',
      chatId: 123,
      toolName: 'email_send_reply',
      riskLevel: 'high',
      normalizedArgs: { to: 'user@example.com' },
      preview: 'Send support reply',
      impact: 'Sends an external email',
      idempotencyKey: 'email_send_reply:msg_1',
      expiresAt: '2026-07-11 13:00:00',
    })

    await expect(store.approve('appr_lifecycle')).resolves.toMatchObject({ status: 'approved' })
    await expect(store.markExecuted('appr_lifecycle')).resolves.toMatchObject({ status: 'executed' })
    await expect(store.markFailed('appr_lifecycle', 'SMTP failed')).resolves.toMatchObject({
      status: 'failed',
      failureReason: 'SMTP failed',
    })
  })

  it('supports denying a pending approval', async () => {
    const store = createStore()
    await store.create({
      id: 'appr_deny',
      chatId: 123,
      toolName: 'vercel_redeploy',
      riskLevel: 'high',
      normalizedArgs: { project: 'polutek' },
      preview: 'Redeploy production',
      impact: 'Changes production deployment',
      idempotencyKey: 'vercel_redeploy:polutek',
      expiresAt: '2026-07-11 13:00:00',
    })

    await expect(store.deny('appr_deny')).resolves.toMatchObject({ status: 'denied' })
  })
})
