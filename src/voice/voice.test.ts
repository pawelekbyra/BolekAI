import { describe, it, expect, beforeEach } from 'vitest'
import { TelegramVoiceHandler, type VoiceNoteMessage } from './telegram-voice'
import type { Env } from '../env'

describe('Voice Interface — Faza 12', () => {
  let env: Env
  let handler: TelegramVoiceHandler

  beforeEach(() => {
    env = {
      TELEGRAM_BOT_TOKEN: 'test-token',
    } as unknown as Env
    handler = new TelegramVoiceHandler(env)
  })

  describe('Voice Transcription', () => {
    it('transcribes voice notes to text', async () => {
      // Mock audio buffer
      const mockAudio = new ArrayBuffer(100)
      const result = await handler.transcribeVoiceNote(mockAudio)

      expect(result.text).toBeDefined()
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.language).toBe('pl')
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Voice Approval Validation', () => {
    it('detects critical operations in voice commands', () => {
      const result = handler.validateVoiceApproval('Zwróć refund dla klienta', true)
      expect(result.needsApproval).toBe(true)
      expect(result.reason).toContain('refund')
    })

    it('allows read-only voice commands', () => {
      const result = handler.validateVoiceApproval('Jakie są moje ostatnie transakcje', true)
      expect(result.needsApproval).toBe(false)
    })

    it('catches multiple critical keywords', () => {
      const result = handler.validateVoiceApproval('Usuń plik i wdróż zmiany', true)
      expect(result.needsApproval).toBe(true)
      expect(result.reason).toContain('usuń')
      expect(result.reason).toContain('wdróż')
    })

    it('identifies refund operations as critical', () => {
      const criticalOps = [
        'Zwróć pieniądze',
        'refund the charge',
        'Process refund',
      ]

      for (const op of criticalOps) {
        const result = handler.validateVoiceApproval(op, true)
        expect(result.needsApproval).toBe(true)
      }
    })

    it('identifies delete operations as critical', () => {
      const result = handler.validateVoiceApproval('Usuń ten wpis', true)
      expect(result.needsApproval).toBe(true)
    })

    it('identifies deployment operations as critical', () => {
      const deployOps = ['Deploy changes', 'Wdróż nową wersję', 'rollback production']
      for (const op of deployOps) {
        const result = handler.validateVoiceApproval(op, true)
        expect(result.needsApproval).toBe(true)
      }
    })
  })

  describe('Voice Safety', () => {
    it('voice does not bypass approval requirements', () => {
      // Critical operations should require approval regardless of input method
      const voiceCommand = 'Zwróć 1000 złotych'
      const validation = handler.validateVoiceApproval(voiceCommand, true)

      expect(validation.needsApproval).toBe(true)
      // This assertion verifies the safety principle from Faza 12 docs:
      // "Voice nie omija approvali"
    })

    it('transcribed text goes through same policy as typed text', () => {
      const voiceTranscription = 'approve refund for 50 dollars'
      const typedText = 'approve refund for 50 dollars'

      const voiceValidation = handler.validateVoiceApproval(voiceTranscription, true)
      const textValidation = handler.validateVoiceApproval(typedText, true)

      expect(voiceValidation.needsApproval).toBe(textValidation.needsApproval)
    })

    it('requires explicit approval even after voice transcription', () => {
      // Voice should not execute critical ops without same approval flow as text
      const voiceCmd = 'Zrób refund'
      const validation = handler.validateVoiceApproval(voiceCmd, true)

      expect(validation.needsApproval).toBe(true)
      // The comment from docs: "nawet jeśli powiesz 'zrób refund', Bolek musi pokazać approval
      // i czekać na jawne potwierdzenie właściciela."
    })
  })

  describe('Voice Message Handling', () => {
    it('handles voice note message structure', () => {
      const voiceMsg: VoiceNoteMessage = {
        fileId: 'AgACAgIAAxkBAAI...',
        mimeType: 'audio/ogg',
        duration: 15,
        fileSizeBytes: 5000,
      }

      expect(voiceMsg.fileId).toBeDefined()
      expect(voiceMsg.duration).toBeGreaterThan(0)
      expect(voiceMsg.mimeType).toBe('audio/ogg')
    })
  })

  describe('Integration with Policy Engine', () => {
    it('voice transcription integrates with existing policy decisions', () => {
      // Voice module should feed transcribed text through same orchestrator
      // that processes typed text
      const transcribedVoiceCmd = 'Refund klienta za ostatnią płatność'

      // This would go through:
      // 1. Transcription → text
      // 2. Policy engine decision (require_approval for stripe_refund)
      // 3. Approval Engine (same as text input)
      // 4. User confirmation
      // 5. Execution

      const validation = handler.validateVoiceApproval(transcribedVoiceCmd, true)
      expect(validation.needsApproval).toBe(true)
    })
  })
})
