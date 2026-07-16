import type { Env } from './env'
import { send } from './telegram'
import { executeVercelTool } from './tools/vercel'

const CHECK_KV_PREFIX = 'log-monitor:checked:'
const ALERT_KV_PREFIX = 'log-monitor:alerted:'

type VercelError = { text?: string; date?: string }

function hourKey(now: Date): string {
  return now.toISOString().slice(0, 13)
}

async function logCheck(env: Env, status: 'ok' | 'warning' | 'error', message: string, metadata: unknown): Promise<void> {
  try {
    await env.DB
      .prepare(`
        INSERT INTO ops_events (source, event_type, status, message, metadata)
        VALUES ('vercel_log_monitor', 'hourly_check', ?, ?, ?)
      `)
      .bind(status, message.slice(0, 500), JSON.stringify(metadata).slice(0, 4000))
      .run()
  } catch {
    // Deployment can briefly run before the D1 migration is applied. Monitoring is best-effort.
  }
}

export async function checkVercelHealth(env: Env, now = new Date()): Promise<void> {
  if (!env.POLUTEK_BRIEFING_CHAT_ID) return
  if (!env.VERCEL_TOKEN) return

  const chatId = Number(env.POLUTEK_BRIEFING_CHAT_ID)
  if (!Number.isFinite(chatId)) return

  const key = `${CHECK_KV_PREFIX}${hourKey(now)}`
  const alreadyChecked = await env.KV.get(key)
  if (alreadyChecked) return
  await env.KV.put(key, now.toISOString(), { expirationTtl: 60 * 60 * 3 })

  const vercelProject = env.POLUTEK_VERCEL_PROJECT ?? 'polutek-pl'

  try {
    const errors = (await executeVercelTool(
      'vercel_get_runtime_errors',
      { project: vercelProject },
      env,
      0
    )) as VercelError[] | string

    if (!Array.isArray(errors) || errors.length === 0) {
      await logCheck(env, 'ok', `Brak błędów runtime w ${vercelProject}`, { vercelProject })
      return
    }

    const fingerprint = JSON.stringify(errors).slice(0, 300)
    const alertKey = `${ALERT_KV_PREFIX}${vercelProject}`
    const lastAlertedFingerprint = await env.KV.get(alertKey)

    if (lastAlertedFingerprint === fingerprint) {
      await logCheck(env, 'warning', 'Błędy runtime nadal obecne, bez zmian — pomijam powtórny alert', {
        vercelProject,
        count: errors.length,
      })
      return
    }

    const lines = errors.slice(0, 10).map((e) => `• ${e.date ?? '?'} — ${e.text ?? JSON.stringify(e)}`)
    const message = [
      `🧯 Wykryto błędy runtime — ${vercelProject}`,
      `Liczba w próbce: ${errors.length}`,
      '',
      ...lines,
    ].join('\n')

    await send(env.TELEGRAM_BOT_TOKEN, chatId, message)
    await env.KV.put(alertKey, fingerprint, { expirationTtl: 60 * 60 * 24 })
    await logCheck(env, 'error', 'Wysłano alert o błędach runtime', { vercelProject, count: errors.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await logCheck(env, 'error', `Błąd podczas sprawdzania logów Vercela: ${message}`, { vercelProject })
  }
}

export async function buildVercelHealthPreview(env: Env): Promise<string> {
  const vercelProject = env.POLUTEK_VERCEL_PROJECT ?? 'polutek-pl'
  const errors = (await executeVercelTool(
    'vercel_get_runtime_errors',
    { project: vercelProject },
    env,
    0
  )) as VercelError[] | string

  if (!Array.isArray(errors) || errors.length === 0) {
    return `Brak błędów runtime w ${vercelProject}.`
  }

  const lines = errors.slice(0, 10).map((e) => `• ${e.date ?? '?'} — ${e.text ?? JSON.stringify(e)}`)
  return [`Błędy runtime — ${vercelProject} (${errors.length})`, '', ...lines].join('\n')
}
