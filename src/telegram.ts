import type { Env } from './env'
import { orchestrate } from './orchestrator'

type TelegramMessage = {
  chat: { id: number }
  from?: { id: number; first_name: string }
  text?: string
  date: number
}

type TelegramUpdate = {
  message?: TelegramMessage
}

export async function send(token: string, chatId: number, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
}

export async function handleUpdate(update: TelegramUpdate, env: Env): Promise<void> {
  const msg = update.message
  if (!msg?.text) return

  const chatId = msg.chat.id

  try {
    const reply = await orchestrate(msg.text, chatId, env)
    await send(env.TELEGRAM_BOT_TOKEN, chatId, reply)
  } catch {
    await send(env.TELEGRAM_BOT_TOKEN, chatId, 'Coś poszło nie tak. Spróbuj jeszcze raz.')
  }
}
