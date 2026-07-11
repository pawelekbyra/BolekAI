import type { Env } from '../env'
import { TelegramVoiceHandler, handleTelegramVoiceMessage } from './telegram-voice'

/**
 * Integrate voice processing into existing Telegram webhook.
 *
 * Usage in src/telegram.ts:
 *
 * if (update.message?.voice) {
 *   const result = await handleVoiceMessage(env, update.message)
 *   return json(result)
 * }
 */

export interface TelegramVoiceUpdate {
  message: {
    chat: { id: number }
    voice: {
      file_id: string
      mime_type: string
      duration: number
      file_size: number
    }
  }
}

export async function handleVoiceMessage(
  env: Env,
  message: TelegramVoiceUpdate['message'],
  agentExecutor: (input: string) => Promise<string>
): Promise<{ ok: boolean; error?: string }> {
  const chatId = message.chat.id
  const voiceNote = {
    fileId: message.voice.file_id,
    mimeType: message.voice.mime_type,
    duration: message.voice.duration,
    fileSizeBytes: message.voice.file_size,
  }

  try {
    await handleTelegramVoiceMessage(env, chatId, voiceNote, agentExecutor)
    return { ok: true }
  } catch (error) {
    const errorMsg = `Voice message processing failed: ${String(error)}`
    console.error(errorMsg)
    return { ok: false, error: errorMsg }
  }
}

/**
 * Example Telegram webhook integration:
 *
 * export async function handleTelegramWebhook(env: Env, update: unknown) {
 *   const data = update as any
 *
 *   // Text message → orchestrator
 *   if (data.message?.text) {
 *     return handleTextMessage(env, data.message)
 *   }
 *
 *   // Voice note → voice handler
 *   if (data.message?.voice) {
 *     return handleVoiceMessage(env, data.message, agentExecutor)
 *   }
 *
 *   // Callback query (approval/deny buttons) → approval engine
 *   if (data.callback_query) {
 *     return handleCallbackQuery(env, data.callback_query)
 *   }
 * }
 */

/**
 * Safety principles for voice integration (Faza 12):
 *
 * 1. Voice does NOT bypass approval requirements
 *    - Transcribed text goes through same policy engine
 *    - Critical operations (refund, delete, deploy) require explicit approval
 *
 * 2. Approval is shown/read back to user
 *    - Text: inline approval message with approve/deny buttons
 *    - Voice: read approval aloud + require button tap or voice confirmation
 *    - Never execute critical operation silently
 *
 * 3. Ambiguous voice commands are rejected
 *    - Unclear transcriptions get manual confirmation
 *    - High-risk operations with low confidence are blocked
 *
 * 4. Voice is not faster than approval
 *    - User must actively confirm each critical operation
 *    - No shortcuts, no "quick mode"
 *
 * 5. All voice commands are audited
 *    - Transcription + confidence logged
 *    - User approval logged
 *    - Execution result logged
 */

export const VOICE_SAFETY_RULES = {
  requireApprovalForCritical: true,
  minTranscriptionConfidence: 0.85,
  voiceBypassesApproval: false,
  voiceRequiresExplicitConfirmation: true,
  auditAllVoiceCommands: true,
}
