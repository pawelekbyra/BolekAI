import type { Env } from './env'
import { orchestrate } from './orchestrator'
import { handleActionConfirmation } from './agent-mode'
import { handleVoiceMessage, type TelegramVoiceUpdate } from './voice/voice-integrations'

type TelegramMessage = {
  chat: { id: number }
  from?: { id: number; first_name: string }
  text?: string
  voice?: TelegramVoiceUpdate['message']['voice']
  date: number
}

type TelegramUpdate = {
  message?: TelegramMessage
}

export async function send(token: string, chatId: number, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}

async function processText(text: string, chatId: number, env: Env): Promise<string> {
  const confirmed = await handleActionConfirmation(text, chatId, env)
  return confirmed ?? orchestrate(text, chatId, env)
}

export async function handleUpdate(update: TelegramUpdate, env: Env): Promise<void> {
  const msg = update.message
  if (!msg) return

  const chatId = msg.chat.id

  try {
    if (msg.voice) {
      await handleVoiceMessage(env, { chat: msg.chat, voice: msg.voice }, (text) => processText(text, chatId, env))
      return
    }

    if (!msg.text) return
    const reply = await processText(msg.text, chatId, env)
    await send(env.TELEGRAM_BOT_TOKEN, chatId, reply)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await send(env.TELEGRAM_BOT_TOKEN, chatId, `ERR: ${msg.slice(0, 300)}`)
  }
}
