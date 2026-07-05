import type { Env } from '../env'
import type { ToolDefinition } from './index'
import { runAction, type ActionExecutionOptions } from '../agent-mode'

const RESEND = 'https://api.resend.com'

type Args = {
  limit?: number
  to?: string
  subject?: string
  text?: string
  inReplyTo?: string
}

type ResendList<T> = {
  object: 'list'
  has_more: boolean
  data: T[]
}

type ResendEmail = {
  id: string
  to?: string[]
  from?: string
  created_at?: string
  subject?: string
  bcc?: string[]
  cc?: string[]
  reply_to?: string[]
  message_id?: string
}

export const emailTools: ToolDefinition[] = [
  {
    name: 'email_resend_sent',
    riskLevel: 'low',
    sideEffect: false,
    description: 'Read-only: pokaż ostatnie maile systemowe wysłane przez Resend. Wymaga RESEND_API_KEY.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maksymalna liczba wyników, domyślnie 20' },
      },
    },
  },
  {
    name: 'email_resend_received',
    riskLevel: 'low',
    sideEffect: false,
    description: 'Read-only: pokaż ostatnie maile odebrane przez Resend Receiving. Wymaga RESEND_API_KEY i skonfigurowanego routingu domeny.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maksymalna liczba wyników, domyślnie 20' },
      },
    },
  },
  {
    name: 'email_triage_latest',
    riskLevel: 'low',
    sideEffect: false,
    description: 'Read-only: pobierz ostatnie odebrane maile i nadaj im prostą kategorię supportową bez wykonywania akcji.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maksymalna liczba wyników, domyślnie 20' },
      },
    },
  },
  {
    name: 'email_send_reply',
    riskLevel: 'high',
    sideEffect: true,
    requiresApproval: true,
    description: 'Akcja: wyślij odpowiedź supportową przez Resend dopiero po confirm gate. Wymaga RESEND_API_KEY i EMAIL_SUPPORT_FROM.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Adres odbiorcy' },
        subject: { type: 'string', description: 'Temat odpowiedzi' },
        text: { type: 'string', description: 'Treść odpowiedzi plain text' },
        inReplyTo: { type: 'string', description: 'Opcjonalny Message-ID oryginalnego maila' },
      },
      required: ['to', 'subject', 'text'],
    },
  },
]

function requireResendKey(env: Env): string | { error: string } {
  if (!env.RESEND_API_KEY) {
    return { error: 'Brak RESEND_API_KEY w Cloudflare Workers. Dodaj klucz Resend, aby monitorować lub wysyłać maile.' }
  }
  return env.RESEND_API_KEY
}

function clampLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return 20
  return Math.max(1, Math.min(Math.floor(value!), 100))
}

async function resendFetch<T>(key: string, path: string, params: Record<string, string | number | undefined> = {}, init: RequestInit = {}): Promise<T> {
  const url = new URL(`${RESEND}${path}`)
  for (const [param, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(param, String(value))
  }

  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
  return res.json()
}

function compactEmail(email: ResendEmail) {
  return {
    id: email.id,
    from: email.from,
    to: email.to,
    subject: email.subject,
    created_at: email.created_at,
    message_id: email.message_id,
  }
}

function categorize(email: ResendEmail): string {
  const text = `${email.subject ?? ''} ${email.from ?? ''}`.toLowerCase()
  if (/(refund|zwrot|chargeback|płatno|platno|payment|stripe)/.test(text)) return 'billing'
  if (/(logowanie|login|konto|hasło|haslo|clerk|dostęp|dostep)/.test(text)) return 'account_access'
  if (/(wideo|video|film|odtwarz|stream|player)/.test(text)) return 'video_playback'
  if (/(błąd|blad|error|awaria|nie działa|nie dziala)/.test(text)) return 'bug_report'
  return 'general_support'
}

async function sendReply(env: Env, args: Required<Pick<Args, 'to' | 'subject' | 'text'>> & Pick<Args, 'inReplyTo'>): Promise<string> {
  const key = requireResendKey(env)
  if (typeof key !== 'string') return key.error
  if (!env.EMAIL_SUPPORT_FROM) return 'Brak EMAIL_SUPPORT_FROM w Cloudflare Workers. Ustaw nadawcę, np. Polutek <kontakt@polutek.pl>.'

  const headers = args.inReplyTo ? { 'In-Reply-To': args.inReplyTo, References: args.inReplyTo } : undefined
  const response = await resendFetch<{ id: string }>(key, '/emails', {}, {
    method: 'POST',
    body: JSON.stringify({
      from: env.EMAIL_SUPPORT_FROM,
      to: [args.to],
      subject: args.subject,
      text: args.text,
      headers,
    }),
  })

  return `Wysłano mail supportowy przez Resend. id=${response.id}`
}

export async function executeEmailTool(
  name: string,
  args: unknown,
  env: Env,
  chatId = 0,
  options: ActionExecutionOptions = {}
): Promise<unknown> {
  const a = (args ?? {}) as Args

  switch (name) {
    case 'email_resend_sent': {
      const key = requireResendKey(env)
      if (typeof key !== 'string') return key
      const emails = await resendFetch<ResendList<ResendEmail>>(key, '/emails', { limit: clampLimit(a.limit) })
      return { has_more: emails.has_more, data: emails.data.map(compactEmail) }
    }

    case 'email_resend_received': {
      const key = requireResendKey(env)
      if (typeof key !== 'string') return key
      const emails = await resendFetch<ResendList<ResendEmail>>(key, '/emails/receiving', { limit: clampLimit(a.limit) })
      return { has_more: emails.has_more, data: emails.data.map(compactEmail) }
    }

    case 'email_triage_latest': {
      const key = requireResendKey(env)
      if (typeof key !== 'string') return key
      const emails = await resendFetch<ResendList<ResendEmail>>(key, '/emails/receiving', { limit: clampLimit(a.limit) })
      return emails.data.map((email) => ({ ...compactEmail(email), category: categorize(email) }))
    }

    case 'email_send_reply': {
      if (!a.to) return { error: 'Brak to — podaj adres odbiorcy.' }
      if (!a.subject) return { error: 'Brak subject — podaj temat odpowiedzi.' }
      if (!a.text) return { error: 'Brak text — podaj treść odpowiedzi.' }

      const normalized = { to: a.to, subject: a.subject, text: a.text, inReplyTo: a.inReplyTo }
      return runAction({
        env,
        chatId,
        description: `wysyłka maila supportowego do ${normalized.to}`,
        intent: { tool: name, args: normalized },
        approved: options.approved,
        action: () => sendReply(env, normalized),
      })
    }

    default:
      throw new Error(`Unknown email tool: ${name}`)
  }
}
