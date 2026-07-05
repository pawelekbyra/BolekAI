import type { Env } from '../env'
import type { ToolDefinition } from './index'

const CLERK = 'https://api.clerk.com/v1'
const DAY_MS = 24 * 60 * 60 * 1000

type ClerkUser = {
  id: string
  created_at: number
  updated_at: number
  banned: boolean
  locked: boolean
  email_addresses?: Array<{ email_address: string; verification?: { status: string } }>
  primary_email_address_id?: string | null
  first_name?: string | null
  last_name?: string | null
  last_sign_in_at?: number | null
}

type ClerkUserList = ClerkUser[] | { data: ClerkUser[] }

type Args = {
  days?: number
  limit?: number
}

export const clerkTools: ToolDefinition[] = [
  {
    name: 'clerk_new_users',
    riskLevel: 'low',
    sideEffect: false,
    description: 'Read-only: pokaż nowych użytkowników Clerk z ostatnich N dni. Wymaga CLERK_SECRET_KEY.',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Liczba dni wstecz, domyślnie 1' },
        limit: { type: 'number', description: 'Maksymalna liczba wyników, domyślnie 20' },
      },
    },
  },
  {
    name: 'clerk_user_summary',
    riskLevel: 'low',
    sideEffect: false,
    description: 'Read-only: policz nowych, zablokowanych i aktywnych użytkowników Clerk w ostatnim oknie czasu. Wymaga CLERK_SECRET_KEY.',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Liczba dni wstecz, domyślnie 1' },
      },
    },
  },
]

function requireClerkKey(env: Env): string | { error: string } {
  if (!env.CLERK_SECRET_KEY) {
    return { error: 'Brak CLERK_SECRET_KEY w Cloudflare Workers. Kod narzędzia jest gotowy, ale musisz dodać read-only/ograniczony secret key w sekretach.' }
  }
  return env.CLERK_SECRET_KEY
}

function clampNumber(value: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.min(Math.floor(value!), max))
}

async function clerkFetch<T>(key: string, path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(`${CLERK}${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v))
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${key}` },
  })

  if (!res.ok) throw new Error(`Clerk ${res.status}: ${await res.text()}`)
  return res.json()
}

function primaryEmail(user: ClerkUser): string | null {
  const primary = user.email_addresses?.find((email) => email.email_address && email.verification?.status === 'verified')
  return primary?.email_address ?? user.email_addresses?.[0]?.email_address ?? null
}

function normalizeUsers(response: ClerkUserList): ClerkUser[] {
  return Array.isArray(response) ? response : response.data
}

function publicUser(user: ClerkUser) {
  return {
    id: user.id,
    email: primaryEmail(user),
    name: [user.first_name, user.last_name].filter(Boolean).join(' ') || null,
    banned: user.banned,
    locked: user.locked,
    created: new Date(user.created_at).toISOString(),
    last_sign_in: user.last_sign_in_at ? new Date(user.last_sign_in_at).toISOString() : null,
  }
}

export async function executeClerkTool(name: string, args: unknown, env: Env): Promise<unknown> {
  const key = requireClerkKey(env)
  if (typeof key !== 'string') return key

  const a = args as Args

  switch (name) {
    case 'clerk_new_users': {
      const days = clampNumber(a.days, 1, 30)
      const limit = clampNumber(a.limit, 20, 100)
      const createdAfter = Date.now() - days * DAY_MS
      const response = await clerkFetch<ClerkUserList>(key, '/users', {
        limit,
        order_by: '-created_at',
      })
      const users = normalizeUsers(response)

      return users
        .filter((u) => u.created_at >= createdAfter)
        .map(publicUser)
    }

    case 'clerk_user_summary': {
      const days = clampNumber(a.days, 1, 30)
      const createdAfter = Date.now() - days * DAY_MS
      const response = await clerkFetch<ClerkUserList>(key, '/users', {
        limit: 100,
        order_by: '-created_at',
      })
      const users = normalizeUsers(response)
      const newUsers = users.filter((u) => u.created_at >= createdAfter)
      const activeUsers = users.filter((u) => u.last_sign_in_at && u.last_sign_in_at >= createdAfter)

      return {
        window_days: days,
        new_users: newUsers.length,
        active_users: activeUsers.length,
        banned_users_in_sample: users.filter((u) => u.banned).length,
        locked_users_in_sample: users.filter((u) => u.locked).length,
        sample_size: users.length,
      }
    }

    default:
      throw new Error(`Unknown clerk tool: ${name}`)
  }
}
