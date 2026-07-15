import type { Env } from './env'
import { send } from './telegram'
import { fetchPolutekPageviews } from './tools/vercel'

const VISITS_KV_PREFIX = 'visits-report:'
const TARGET_LOCAL_HOUR = 9
const WARSAW_TZ = 'Europe/Warsaw'

function warsawDateKey(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: WARSAW_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

function warsawHour(now: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: WARSAW_TZ, hour: '2-digit', hour12: false }).format(now))
}

function shouldRunNow(now: Date): boolean {
  return warsawHour(now) === TARGET_LOCAL_HOUR
}

function warsawOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: WARSAW_TZ, timeZoneName: 'shortOffset' }).formatToParts(instant)
  const offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0'
  const match = offset.match(/GMT([+-]\d+)(?::(\d+))?/)
  if (!match) return 0
  const hours = Number(match[1])
  const minutes = match[2] ? Number(match[2]) : 0
  return hours * 60 + (hours < 0 ? -minutes : minutes)
}

function warsawMidnightUtc(dateKey: string, nearInstant: Date): Date {
  const offsetMinutes = warsawOffsetMinutes(nearInstant)
  const utcMidnightForDate = new Date(`${dateKey}T00:00:00.000Z`)
  return new Date(utcMidnightForDate.getTime() - offsetMinutes * 60 * 1000)
}

function yesterdayWarsawRange(now: Date): { since: Date; until: Date; dateKey: string } {
  const yesterdayInstant = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const dateKey = warsawDateKey(yesterdayInstant)
  const todayKey = warsawDateKey(now)
  return {
    since: warsawMidnightUtc(dateKey, yesterdayInstant),
    until: warsawMidnightUtc(todayKey, now),
    dateKey,
  }
}

async function logVisitsReport(env: Env, status: 'ok' | 'error', message: string, metadata: unknown): Promise<void> {
  try {
    await env.DB
      .prepare(`
        INSERT INTO ops_events (source, event_type, status, message, metadata)
        VALUES ('polutek_visits_report', 'daily_visits_report', ?, ?, ?)
      `)
      .bind(status, message.slice(0, 500), JSON.stringify(metadata).slice(0, 4000))
      .run()
  } catch {
    // Deployment can briefly run before the D1 migration is applied. Report delivery wins over audit logging.
  }
}

export async function buildVisitsReportMessage(env: Env, now = new Date()): Promise<string> {
  const { since, until, dateKey } = yesterdayWarsawRange(now)
  const result = await fetchPolutekPageviews(env, since, until)

  return [
    `📈 Wejścia na polutek.pl — wczoraj (${dateKey})`,
    `Odsłony: ${result.pageviews}`,
    `Unikalni odwiedzający: ${result.visitors}`,
  ].join('\n')
}

export async function sendDailyVisitsReport(env: Env, now = new Date()): Promise<void> {
  if (!env.POLUTEK_VISITS_CHAT_ID) return
  if (!env.VERCEL_TOKEN) return

  const chatId = Number(env.POLUTEK_VISITS_CHAT_ID)
  if (!Number.isFinite(chatId)) return
  if (!shouldRunNow(now)) return

  const dateKey = warsawDateKey(now)
  const key = `${VISITS_KV_PREFIX}${dateKey}`
  const alreadySent = await env.KV.get(key)
  if (alreadySent) return

  try {
    const message = await buildVisitsReportMessage(env, now)
    await send(env.TELEGRAM_BOT_TOKEN, chatId, message)
    await env.KV.put(key, now.toISOString(), { expirationTtl: 60 * 60 * 36 })
    await logVisitsReport(env, 'ok', `Wysłano raport wejść do chat_id=${chatId}`, { key, chatId, message })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await send(env.TELEGRAM_BOT_TOKEN, chatId, `⚠️ Nie udało się pobrać raportu wejść na polutek.pl: ${message}`)
    await env.KV.put(key, now.toISOString(), { expirationTtl: 60 * 60 * 36 })
    await logVisitsReport(env, 'error', message, { key, chatId })
  }
}
