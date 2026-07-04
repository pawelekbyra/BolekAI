import type { Env } from '../env'
import type { ToolDefinition } from './index'

type OpsConfig = {
  baseUrl: string
  token: string
}

type PolutekSummaryArgs = {
  days?: number
}

type PolutekPatronArgs = {
  userId?: string
}

export const polutekTools: ToolDefinition[] = [
  {
    name: 'polutek_daily_summary',
    description: 'Read-only: pobierz dzienne podsumowanie Polutka z ops-API (przychód, patroni, pending, userzy, awarie). Wymaga POLUTEK_OPS_URL i POLUTEK_OPS_TOKEN.',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Liczba dni wstecz dla podsumowania, domyślnie 1' },
      },
    },
  },
  {
    name: 'polutek_patron_status',
    description: 'Read-only: sprawdź status patrona w Polutku przez ops-API. Nie zwraca videoUrl. Wymaga POLUTEK_OPS_URL i POLUTEK_OPS_TOKEN.',
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'Identyfikator użytkownika Polutka/Clerka do diagnostyki patronatu' },
      },
      required: ['userId'],
    },
  },
]

function requireOpsConfig(env: Env): OpsConfig | { error: string } {
  if (!env.POLUTEK_OPS_URL || !env.POLUTEK_OPS_TOKEN) {
    return {
      error: 'Brak POLUTEK_OPS_URL lub POLUTEK_OPS_TOKEN w Cloudflare Workers. Kod narzędzia jest gotowy, ale najpierw trzeba wdrożyć ops-API Polutka i dodać sekrety.',
    }
  }

  return {
    baseUrl: env.POLUTEK_OPS_URL.replace(/\/+$/, ''),
    token: env.POLUTEK_OPS_TOKEN,
  }
}

function clampDays(value: number | undefined): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(Math.floor(value!), 30))
}

async function opsFetch<T>(config: OpsConfig, path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(`${config.baseUrl}${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) throw new Error(`Polutek ops-API ${res.status}: ${await res.text()}`)
  return res.json()
}

function assertNoVideoUrl(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(assertNoVideoUrl)
  if (!value || typeof value !== 'object') return value

  const sanitized: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(value)) {
    if (key.toLowerCase() === 'videourl') continue
    sanitized[key] = assertNoVideoUrl(nested)
  }
  return sanitized
}

export async function executePolutekTool(name: string, args: unknown, env: Env): Promise<unknown> {
  const config = requireOpsConfig(env)
  if ('error' in config) return config

  switch (name) {
    case 'polutek_daily_summary': {
      const a = (args ?? {}) as PolutekSummaryArgs
      const days = clampDays(a.days)
      const summary = await opsFetch<unknown>(config, '/summary', { days })
      return assertNoVideoUrl(summary)
    }

    case 'polutek_patron_status': {
      const a = (args ?? {}) as PolutekPatronArgs
      if (!a.userId) return { error: 'Brak userId — podaj identyfikator użytkownika Polutka/Clerka.' }
      const patron = await opsFetch<unknown>(config, `/patron/${encodeURIComponent(a.userId)}`)
      return assertNoVideoUrl(patron)
    }

    default:
      throw new Error(`Unknown polutek tool: ${name}`)
  }
}
