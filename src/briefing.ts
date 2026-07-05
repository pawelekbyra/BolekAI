import type { Env } from './env'
import { send } from './telegram'
import { executeStripeTool } from './tools/stripe'
import { executeClerkTool } from './tools/clerk'
import { buildPolutekConfigStatus, executePolutekTool } from './tools/polutek'
import { executeVercelTool } from './tools/vercel'
import { executeEmailTool } from './tools/email-imap-smtp'

const BRIEFING_KV_PREFIX = 'briefing:polutek:'
const DEFAULT_HOUR_UTC = 7
const TELEGRAM_SAFE_CHUNK = 3600

type BriefingStatus = 'ok' | 'warning' | 'error'

type BriefingSection = {
  title: string
  icon: string
  status: BriefingStatus
  body: string
}

function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

function configuredHour(env: Env): number {
  const parsed = Number(env.POLUTEK_BRIEFING_HOUR_UTC ?? DEFAULT_HOUR_UTC)
  if (!Number.isFinite(parsed)) return DEFAULT_HOUR_UTC
  return Math.max(0, Math.min(Math.floor(parsed), 23))
}

function shouldRunNow(env: Env, now = new Date()): boolean {
  return now.getUTCHours() === configuredHour(env)
}

function isErrorObject(value: unknown): value is { error: unknown } {
  return Boolean(value && typeof value === 'object' && 'error' in value)
}

function compactValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function compactList(value: unknown, emptyLabel = 'brak'): string {
  if (!Array.isArray(value)) return compactValue(value)
  if (value.length === 0) return emptyLabel

  return value
    .slice(0, 5)
    .map((item) => {
      if (!item || typeof item !== 'object') return `• ${compactValue(item)}`
      const record = item as Record<string, unknown>
      const first = record.id ?? record.email ?? record.url ?? record.state ?? record.status ?? 'pozycja'
      const details = Object.entries(record)
        .filter(([key]) => !['id', 'email', 'url'].includes(key))
        .slice(0, 3)
        .map(([key, nested]) => `${key}: ${compactValue(nested)}`)
        .join(', ')
      return `• ${compactValue(first)}${details ? ` (${details})` : ''}`
    })
    .join('\n')
}

function moneyLine(summary: Record<string, unknown>): string {
  const revenue = summary.gross_revenue && typeof summary.gross_revenue === 'object'
    ? Object.values(summary.gross_revenue).join(', ')
    : '0'

  return [
    `przychód brutto: ${revenue}`,
    `udane: ${compactValue(summary.successful_count ?? 0)}`,
    `nieudane: ${compactValue(summary.failed_count ?? 0)}`,
    `refundy: ${compactValue(summary.refunded_count ?? 0)}`,
  ].join(' · ')
}

function sectionFromValue(title: string, icon: string, value: unknown, formatter?: (value: unknown) => string): BriefingSection {
  if (isErrorObject(value)) {
    return { title, icon, status: 'warning', body: `⚠️ ${compactValue(value.error)}` }
  }

  return {
    title,
    icon,
    status: 'ok',
    body: formatter ? formatter(value) : compactList(value),
  }
}

async function safeLoad(load: () => Promise<unknown>): Promise<unknown> {
  try {
    return await load()
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

function formatSections(sections: BriefingSection[]): string {
  return sections
    .map((section) => `${section.icon} ${section.title}\n${section.body}`)
    .join('\n\n')
}

function splitMessage(text: string): string[] {
  if (text.length <= TELEGRAM_SAFE_CHUNK) return [text]

  const chunks: string[] = []
  let rest = text
  while (rest.length > TELEGRAM_SAFE_CHUNK) {
    const splitAt = rest.lastIndexOf('\n\n', TELEGRAM_SAFE_CHUNK)
    const index = splitAt > 0 ? splitAt : TELEGRAM_SAFE_CHUNK
    chunks.push(rest.slice(0, index))
    rest = rest.slice(index).trimStart()
  }
  if (rest) chunks.push(rest)
  return chunks
}

async function logBriefing(env: Env, status: BriefingStatus, message: string, metadata: unknown): Promise<void> {
  try {
    await env.DB
      .prepare(`
        INSERT INTO ops_events (source, event_type, status, message, metadata)
        VALUES ('polutek_briefing', 'daily_briefing', ?, ?, ?)
      `)
      .bind(status, message.slice(0, 500), JSON.stringify(metadata).slice(0, 4000))
      .run()
  } catch {
    // Deployment can briefly run before the D1 migration is applied. Briefing delivery wins over audit logging.
  }
}

export async function buildPolutekBriefing(env: Env, now = new Date()): Promise<string> {
  const vercelProject = env.POLUTEK_VERCEL_PROJECT ?? 'polutek-pl'
  const [polutek, stripe, pending, disputes, clerk, deployments, runtimeErrors, emailTriage] = await Promise.all([
    safeLoad(() => executePolutekTool('polutek_daily_summary', { days: 1 }, env)),
    safeLoad(() => executeStripeTool('stripe_daily_summary', { days: 1 }, env)),
    safeLoad(() => executeStripeTool('stripe_pending_payments', { limit: 10 }, env)),
    safeLoad(() => executeStripeTool('stripe_disputes', { limit: 10 }, env)),
    safeLoad(() => executeClerkTool('clerk_user_summary', { days: 1 }, env)),
    safeLoad(() => executeVercelTool('vercel_get_deployments', { project: vercelProject }, env, 0)),
    safeLoad(() => executeVercelTool('vercel_get_runtime_errors', { project: vercelProject }, env, 0)),
    safeLoad(() => executeEmailTool('email_triage_latest', { limit: 10 }, env, 0)),
  ])

  const configStatus = buildPolutekConfigStatus(env)

  const sections = [
    sectionFromValue('Konfiguracja integracji', '🔐', configStatus, (value) => {
      const record = value as Record<string, unknown>
      return `gotowe: ${compactValue(record.configured_required)}/${compactValue(record.total_required)} · brakuje: ${compactList(record.missing_required, 'brak')}`
    }),
    sectionFromValue('Polutek ops', '📊', polutek),
    sectionFromValue('Stripe przychód', '💳', stripe, (value) => moneyLine(value as Record<string, unknown>)),
    sectionFromValue('Płatności do uwagi', '⏳', pending, (value) => compactList(value, 'brak płatności wymagających uwagi')),
    sectionFromValue('Spory / chargebacki', '🚨', disputes, (value) => compactList(value, 'brak sporów')),
    sectionFromValue('Clerk', '👤', clerk, (value) => {
      const record = value as Record<string, unknown>
      return `nowi: ${compactValue(record.new_users ?? 0)} · aktywni: ${compactValue(record.active_users ?? 0)} · zablokowani w próbce: ${compactValue(record.banned_users_in_sample ?? 0)}`
    }),
    sectionFromValue(`Vercel deploye (${vercelProject})`, '▲', deployments, (value) => compactList(value, 'brak deploymentów')),
    sectionFromValue(`Vercel runtime errors (${vercelProject})`, '🧯', runtimeErrors, (value) => compactList(value, 'brak błędów runtime w ostatniej próbce')),
    sectionFromValue('Poczta / triage', '📬', emailTriage, (value) => compactList(value, 'brak nowych maili supportowych')),
  ]

  const warnings = sections.filter((section) => section.status !== 'ok').length
  const header = `Poranny briefing Polutka — ${todayKey(now)}\nStatus: ${warnings ? `${warnings} sekcji wymaga konfiguracji/uwagi` : 'zielono'}`
  const footer = 'Do decyzji: przejrzyj pending/disputes/runtime errors. Akcje finansowe i wysyłka maili nadal tylko po ręcznym potwierdzeniu.'

  return `${header}\n\n${formatSections(sections)}\n\n${footer}`
}

export async function sendDailyPolutekBriefing(env: Env, now = new Date()): Promise<void> {
  if (!env.POLUTEK_BRIEFING_CHAT_ID) return

  const chatId = Number(env.POLUTEK_BRIEFING_CHAT_ID)
  if (!Number.isFinite(chatId)) return
  if (!shouldRunNow(env, now)) return

  const key = `${BRIEFING_KV_PREFIX}${todayKey(now)}`
  const alreadySent = await env.KV.get(key)
  if (alreadySent) return

  const briefing = await buildPolutekBriefing(env, now)
  for (const chunk of splitMessage(briefing)) {
    await send(env.TELEGRAM_BOT_TOKEN, chatId, chunk)
  }

  await env.KV.put(key, now.toISOString(), { expirationTtl: 60 * 60 * 36 })
  await logBriefing(env, 'ok', `Wysłano briefing Polutka do chat_id=${chatId}`, { key, chatId, sentAt: now.toISOString() })
}
