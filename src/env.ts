export type Env = {
  DB: D1Database
  KV: KVNamespace
  AI: Ai
  TELEGRAM_BOT_TOKEN: string
  TELEGRAM_WEBHOOK_SECRET: string
  AI_MODEL: string
  GITHUB_TOKEN: string
  VERCEL_TOKEN: string
  ANTHROPIC_API_KEY: string
  STRIPE_KEY?: string
  CLERK_SECRET_KEY?: string
  POLUTEK_OPS_URL?: string
  POLUTEK_OPS_TOKEN?: string
  POLUTEK_BRIEFING_CHAT_ID?: string
  POLUTEK_BRIEFING_HOUR_UTC?: string
  POLUTEK_VERCEL_PROJECT?: string
}
