import type { Env } from '../env'

export interface VoiceNoteMessage {
  fileId: string
  mimeType: string
  duration: number
  fileSizeBytes: number
}

export interface VoiceTranscriptionResult {
  text: string
  confidence: number
  language: string
  duration: number
}

export interface VoiceResponse {
  text: string
  audioFileId?: string
  audioUrl?: string
}

export class TelegramVoiceHandler {
  private botToken: string
  private apiBase = 'https://api.telegram.org'

  constructor(private env: Env) {
    this.botToken = env.TELEGRAM_BOT_TOKEN || ''
  }

  async downloadVoiceFile(fileId: string): Promise<ArrayBuffer> {
    const fileInfoUrl = `${this.apiBase}/bot${this.botToken}/getFile?file_id=${fileId}`
    const fileInfoRes = await fetch(fileInfoUrl)
    if (!fileInfoRes.ok) throw new Error(`Telegram getFile failed: ${fileInfoRes.status}`)

    const fileInfo = (await fileInfoRes.json()) as {
      ok: boolean
      description?: string
      result?: { file_path: string }
    }
    if (!fileInfo.ok) throw new Error(`Telegram error: ${fileInfo.description}`)

    const filePath = fileInfo.result?.file_path
    if (!filePath) throw new Error('No file path in Telegram response')

    const fileUrl = `${this.apiBase}/file/bot${this.botToken}/${filePath}`

    const fileRes = await fetch(fileUrl)
    if (!fileRes.ok) throw new Error(`File download failed: ${fileRes.status}`)

    return fileRes.arrayBuffer()
  }

  async transcribeVoiceNote(audioBuffer: ArrayBuffer): Promise<VoiceTranscriptionResult> {
    // Use Cloudflare Workers AI or external transcription service
    // For now, return mock response with the pattern that would be used
    const blob = new Blob([audioBuffer], { type: 'audio/ogg' })

    // In production, integrate with Cloudflare Workers AI or Deepgram/Assembly AI
    // This is a placeholder for the interface
    return {
      text: '[Transcribed audio content would go here]',
      confidence: 0.95,
      language: 'pl',
      duration: Math.floor(audioBuffer.byteLength / 48000), // estimate
    }
  }

  async sendVoiceResponse(chatId: number, text: string): Promise<void> {
    const sendUrl = `${this.apiBase}/bot${this.botToken}/sendMessage`

    const payload = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }

    const res = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) throw new Error(`Send message failed: ${res.status}`)
  }

  async sendAudioResponse(
    chatId: number,
    audioUrl: string,
    caption?: string
  ): Promise<void> {
    const sendUrl = `${this.apiBase}/bot${this.botToken}/sendAudio`

    const payload: Record<string, unknown> = {
      chat_id: chatId,
      audio: audioUrl,
      title: 'Bolek Response',
    }

    if (caption) {
      payload.caption = caption
    }

    const res = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) throw new Error(`Send audio failed: ${res.status}`)
  }

  validateVoiceApproval(
    text: string,
    requiresApproval: boolean
  ): {
    needsApproval: boolean
    reason: string
  } {
    const lowerText = text.toLowerCase()

    // Critical keywords in English and Polish (with accent variants)
    const criticalKeywords = [
      // English
      'refund',
      'delete',
      'remove',
      'push',
      'deploy',
      'rollback',
      'cancel',
      'deny',
      // Polish (with accents)
      'zwróć',
      'zwrot',
      'usun',
      'usuń',
      'wdróż',
      'wdróz',
      'wdroz',
      'cofnij',
      'wycofaj',
      'odmów',
      'odrzuc',
      'odrzuć',
      // Polish variants without accents
      'zwroc',
      'usun',
      'odmiow',
    ]

    const mentioned = criticalKeywords.filter((kw) => lowerText.includes(kw))

    if (mentioned.length > 0 && requiresApproval) {
      return {
        needsApproval: true,
        reason: `Voice command mentions critical operations: ${mentioned.join(', ')}`,
      }
    }

    return {
      needsApproval: false,
      reason: '',
    }
  }
}

export async function handleTelegramVoiceMessage(
  env: Env,
  chatId: number,
  voiceNoteMessage: VoiceNoteMessage,
  agentExecutor: (input: string) => Promise<string>
): Promise<VoiceResponse> {
  const handler = new TelegramVoiceHandler(env)

  try {
    // Step 1: Download voice file
    const audioBuffer = await handler.downloadVoiceFile(voiceNoteMessage.fileId)

    // Step 2: Transcribe
    const transcription = await handler.transcribeVoiceNote(audioBuffer)

    // Step 3: Validate critical operations
    const validation = handler.validateVoiceApproval(transcription.text, true)

    // Step 4: Execute with agent
    const responseText = await agentExecutor(transcription.text)

    // Step 5: Send text response (no audio generation for now)
    await handler.sendVoiceResponse(chatId, responseText)

    return {
      text: responseText,
    }
  } catch (error) {
    const errorMsg = `Voice processing failed: ${String(error)}`
    await handler.sendVoiceResponse(chatId, errorMsg)
    throw error
  }
}
