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
  RESEND_API_KEY?: string
  EMAIL_SUPPORT_FROM?: string
  EMAIL_IMAP_HOST?: string
  EMAIL_IMAP_PORT?: string
  EMAIL_IMAP_USER?: string
  EMAIL_IMAP_PASSWORD?: string
  EMAIL_SMTP_HOST?: string
  EMAIL_SMTP_PORT?: string
  EMAIL_SMTP_USER?: string
  EMAIL_SMTP_PASSWORD?: string
  BOLEK_OPENAI_ADAPTER_KEY?: string
  BOLEK_CORS_ORIGIN?: string
  // External services (tri-tier architecture)
  CHAT_SERVICE_URL?: string
  CHAT_SERVICE_TOKEN?: string
  FLOW_SERVICE_URL?: string
  FLOW_SERVICE_TOKEN?: string
  KB_SERVICE_URL?: string
  KB_SERVICE_TOKEN?: string
  // Tools — Calendar
  GOOGLE_CALENDAR_API_KEY?: string
  GOOGLE_CALENDAR_CLIENT_ID?: string
  GOOGLE_CALENDAR_CLIENT_SECRET?: string
  GOOGLE_CALENDAR_REFRESH_TOKEN?: string
  // Tools — Weather
  USER_LATITUDE?: string
  USER_LONGITUDE?: string
}
