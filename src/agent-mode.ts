import type { Env } from './env'
import { send } from './telegram'
import { executeTool } from './tools'
import { ApprovalStore } from './approvals'
import { auditEvent } from './audit'

export type AgentMode = 'autonomous' | 'confirm' | 'manual'

export type ActionIntent = {
  tool: string
  args: unknown
}

export type ActionExecutionOptions = {
  approved?: boolean
  approvalId?: string
}

export async function getMode(db: D1Database): Promise<AgentMode> {
  const row = await db
    .prepare('SELECT value FROM owner_facts WHERE key = ?')
    .bind('agent_mode')
    .first<{ value: string }>()

  const value = row?.value ?? 'confirm'
  if (value === 'autonomous' || value === 'manual') return value
  return 'confirm'
}

export async function setMode(db: D1Database, mode: AgentMode): Promise<void> {
  await db
    .prepare(`
      INSERT INTO owner_facts (key, value, updated_at)
      VALUES ('agent_mode', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `)
    .bind(mode)
    .run()
}

type ActionOptions = {
  env: Env
  chatId: number
  description: string
  action: () => Promise<string>
  intent?: ActionIntent
  approved?: boolean
}

export async function runAction({ env, chatId, description, action, intent, approved = false }: ActionOptions): Promise<string> {
  const mode = await getMode(env.DB)

  if (mode === 'manual') {
    return `Tryb manualny — nie wykonuję akcji. Miałem zrobić: ${description}`
  }

  if (approved || mode === 'autonomous') {
    const result = await action()
    await send(env.TELEGRAM_BOT_TOKEN, chatId, `✅ Wykonano: *${description}*\n\n${result}`)
    return result
  }

  if (!intent) {
    return `Ta akcja wymaga potwierdzenia, ale nie ma zapisanej wykonywalnej intencji: ${description}`
  }

  await env.DB
    .prepare(`
      INSERT INTO pending_actions (chat_id, description, tool_name, tool_args, status)
      VALUES (?, ?, ?, ?, 'pending')
    `)
    .bind(chatId, description, intent.tool, JSON.stringify(intent.args ?? {}))
    .run()

  await send(env.TELEGRAM_BOT_TOKEN, chatId, `❓ Mam wykonać: *${description}*\n\nOdpisz "tak" żeby potwierdzić albo "nie" żeby anulować.`)
  return `Czekam na Twoje potwierdzenie.`
}

export async function handleActionConfirmation(text: string, chatId: number, env: Env): Promise<string | null> {
  const trimmed = text.trim()
  const approvalCommand = trimmed.match(/^\/(approve|deny)\s+([0-9a-fA-F-]{36})$/)

  if (approvalCommand) {
    const [, command, approvalId] = approvalCommand
    const store = new ApprovalStore(env.DB)
    const approval = await store.get(approvalId)

    if (!approval || approval.chat_id !== chatId) {
      return `Nie znalazłem approvala ${approvalId} dla tego chatu.`
    }

    if (command === 'deny') {
      const denied = await store.deny(approvalId, chatId)
      if (denied) {
        await auditEvent(env.DB, {
          chatId,
          eventType: 'approval_denied',
          toolName: approval.tool_name,
          riskLevel: approval.risk_level,
          approvalId,
          status: 'denied',
        })
        return `Odrzuciłem approval ${approvalId} dla ${approval.tool_name}.`
      }
      return `Nie mogę odrzucić approvala ${approvalId}, bo ma status ${approval.status}.`
    }

    if (approval.status === 'executed') {
      return `Approval ${approvalId} został już wykonany. Nie wykonuję go drugi raz.`
    }
    if (approval.status !== 'pending') {
      return `Approval ${approvalId} nie jest pending (status: ${approval.status}).`
    }
    if (new Date(approval.expires_at).getTime() <= Date.now()) {
      await store.markExpired(approvalId)
      await auditEvent(env.DB, {
        chatId,
        eventType: 'approval_expired',
        toolName: approval.tool_name,
        riskLevel: approval.risk_level,
        approvalId,
        status: 'expired',
        data: { expiresAt: approval.expires_at },
      })
      return `Approval ${approvalId} wygasł ${approval.expires_at}. Utwórz nowy approval, jeśli akcja nadal ma być wykonana.`
    }

    const approved = await store.approve(approvalId, chatId)
    if (approved) {
      await auditEvent(env.DB, {
        chatId,
        eventType: 'approval_approved',
        toolName: approval.tool_name,
        riskLevel: approval.risk_level,
        approvalId,
        status: 'approved',
      })
    }
    if (!approved) {
      const current = await store.get(approvalId)
      return `Nie mogę zatwierdzić approvala ${approvalId} (status: ${current?.status ?? 'unknown'}).`
    }

    try {
      const args = JSON.parse(approval.normalized_args) as unknown
      const result = await executeTool(approval.tool_name, args, env.DB, chatId, env, { approved: true, approvalId })
      const marked = await store.markExecuted(approvalId, result)
      if (marked) {
        await auditEvent(env.DB, {
          chatId,
          eventType: 'approval_executed',
          toolName: approval.tool_name,
          riskLevel: approval.risk_level,
          approvalId,
          status: 'executed',
        })
      }
      if (!marked) {
        return `Approval ${approvalId} został wykonany, ale nie udało się oznaczyć go jako executed. Sprawdź audyt/logi przed ponowieniem.`
      }
      return `Zatwierdzone i wykonane approval ${approvalId}: ${approval.tool_name}\n\n${typeof result === 'string' ? result : JSON.stringify(result)}`
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const failed = await store.markFailed(approvalId, message)
      if (failed) {
        await auditEvent(env.DB, {
          chatId,
          eventType: 'approval_failed',
          toolName: approval.tool_name,
          riskLevel: approval.risk_level,
          approvalId,
          status: 'failed',
          data: { error: message },
        })
      }
      throw err
    }
  }

  const normalized = trimmed.toLowerCase()
  const isYes = ['tak', 't', 'yes', 'y'].includes(normalized)
  const isNo = ['nie', 'n', 'no'].includes(normalized)
  if (!isYes && !isNo) return null

  const pending = await env.DB
    .prepare(`
      SELECT id, description, tool_name, tool_args
      FROM pending_actions
      WHERE chat_id = ? AND status = 'pending'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `)
    .bind(chatId)
    .first<{ id: number; description: string; tool_name: string; tool_args: string }>()

  if (!pending) return null

  if (isNo) {
    await env.DB
      .prepare(`UPDATE pending_actions SET status = 'cancelled', resolved_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(pending.id)
      .run()
    return `Anulowałem: ${pending.description}`
  }

  await env.DB
    .prepare(`UPDATE pending_actions SET status = 'running', resolved_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(pending.id)
    .run()

  try {
    const args = JSON.parse(pending.tool_args) as unknown
    const result = await executeTool(pending.tool_name, args, env.DB, chatId, env, { approved: true })
    await env.DB
      .prepare(`UPDATE pending_actions SET status = 'done', result = ? WHERE id = ?`)
      .bind(typeof result === 'string' ? result : JSON.stringify(result), pending.id)
      .run()
    return `Potwierdzone i wykonane: ${pending.description}\n\n${typeof result === 'string' ? result : JSON.stringify(result)}`
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await env.DB
      .prepare(`UPDATE pending_actions SET status = 'failed', result = ? WHERE id = ?`)
      .bind(message, pending.id)
      .run()
    throw err
  }
}
