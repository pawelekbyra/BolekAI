import type { Env } from '../env'
import type { ToolDefinition } from './index'

const STRIPE = 'https://api.stripe.com/v1'
const DAY_SECONDS = 24 * 60 * 60

type StripeList<T> = {
  data: T[]
  has_more: boolean
}

type StripePaymentIntent = {
  id: string
  amount: number
  currency: string
  status: string
  created: number
  description?: string | null
  customer?: string | null
}

type StripeCharge = {
  id: string
  amount: number
  currency: string
  status: string
  paid: boolean
  refunded: boolean
  created: number
  description?: string | null
  failure_code?: string | null
  failure_message?: string | null
}

type StripeDispute = {
  id: string
  amount: number
  currency: string
  status: string
  reason: string
  created: number
  charge: string
}

type Args = {
  days?: number
  limit?: number
}

export const stripeTools: ToolDefinition[] = [
  {
    name: 'stripe_daily_summary',
    description: 'Read-only: podsumuj przychód i płatności Stripe z ostatnich N dni. Wymaga STRIPE_KEY.',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Liczba dni wstecz, domyślnie 1' },
      },
    },
  },
  {
    name: 'stripe_failed_payments',
    description: 'Read-only: pokaż ostatnie nieudane płatności Stripe. Wymaga STRIPE_KEY.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maksymalna liczba wyników, domyślnie 10' },
      },
    },
  },
  {
    name: 'stripe_pending_payments',
    description: 'Read-only: pokaż płatności Stripe w stanie wymagającym uwagi lub niedokończone. Wymaga STRIPE_KEY.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maksymalna liczba wyników, domyślnie 10' },
      },
    },
  },
  {
    name: 'stripe_disputes',
    description: 'Read-only: pokaż ostatnie spory/chargebacki Stripe. Wymaga STRIPE_KEY.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maksymalna liczba wyników, domyślnie 10' },
      },
    },
  },
]

function requireStripeKey(env: Env): string | { error: string } {
  if (!env.STRIPE_KEY) {
    return { error: 'Brak STRIPE_KEY w Cloudflare Workers. Kod narzędzia jest gotowy, ale musisz dodać restricted read-only key w sekretach.' }
  }
  return env.STRIPE_KEY
}

function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

function clampLimit(limit: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(limit)) return fallback
  return Math.max(1, Math.min(Math.floor(limit!), max))
}

function formatMoney(amount: number, currency: string): string {
  return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`
}

async function stripeFetch<T>(key: string, path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(`${STRIPE}${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v))
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${key}` },
  })

  if (!res.ok) throw new Error(`Stripe ${res.status}: ${await res.text()}`)
  return res.json()
}

function summarizeCharges(charges: StripeCharge[]) {
  const paid = charges.filter((c) => c.paid && c.status === 'succeeded' && !c.refunded)
  const failed = charges.filter((c) => c.status === 'failed' || !c.paid)
  const refunded = charges.filter((c) => c.refunded)

  const byCurrency = paid.reduce<Record<string, number>>((acc, c) => {
    acc[c.currency] = (acc[c.currency] ?? 0) + c.amount
    return acc
  }, {})

  return {
    successful_count: paid.length,
    failed_count: failed.length,
    refunded_count: refunded.length,
    gross_revenue: Object.fromEntries(Object.entries(byCurrency).map(([currency, amount]) => [currency, formatMoney(amount, currency)])),
  }
}

export async function executeStripeTool(name: string, args: unknown, env: Env): Promise<unknown> {
  const key = requireStripeKey(env)
  if (typeof key !== 'string') return key

  const a = args as Args

  switch (name) {
    case 'stripe_daily_summary': {
      const days = clampLimit(a.days, 1, 30)
      const createdGte = toUnixSeconds(new Date(Date.now() - days * DAY_SECONDS * 1000))
      const charges = await stripeFetch<StripeList<StripeCharge>>(key, '/charges', {
        limit: 100,
        'created[gte]': createdGte,
      })

      return {
        window_days: days,
        ...summarizeCharges(charges.data),
        sample_size: charges.data.length,
        has_more: charges.has_more,
      }
    }

    case 'stripe_failed_payments': {
      const limit = clampLimit(a.limit, 10, 25)
      const charges = await stripeFetch<StripeList<StripeCharge>>(key, '/charges', { limit })
      return charges.data
        .filter((c) => c.status === 'failed' || !c.paid)
        .map((c) => ({
          id: c.id,
          amount: formatMoney(c.amount, c.currency),
          created: new Date(c.created * 1000).toISOString(),
          failure_code: c.failure_code,
          failure_message: c.failure_message,
          description: c.description,
        }))
    }

    case 'stripe_pending_payments': {
      const limit = clampLimit(a.limit, 10, 25)
      const intents = await stripeFetch<StripeList<StripePaymentIntent>>(key, '/payment_intents', { limit })
      return intents.data
        .filter((p) => ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'].includes(p.status))
        .map((p) => ({
          id: p.id,
          amount: formatMoney(p.amount, p.currency),
          status: p.status,
          created: new Date(p.created * 1000).toISOString(),
          customer: p.customer,
          description: p.description,
        }))
    }

    case 'stripe_disputes': {
      const limit = clampLimit(a.limit, 10, 25)
      const disputes = await stripeFetch<StripeList<StripeDispute>>(key, '/disputes', { limit })
      return disputes.data.map((d) => ({
        id: d.id,
        charge: d.charge,
        amount: formatMoney(d.amount, d.currency),
        status: d.status,
        reason: d.reason,
        created: new Date(d.created * 1000).toISOString(),
      }))
    }

    default:
      throw new Error(`Unknown stripe tool: ${name}`)
  }
}
