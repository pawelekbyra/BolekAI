import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { handleVoiceMessageMock, orchestrateMock, handleActionConfirmationMock } = vi.hoisted(() => ({
  handleVoiceMessageMock: vi.fn().mockResolvedValue({ ok: true }),
  orchestrateMock: vi.fn().mockResolvedValue('text reply'),
  handleActionConfirmationMock: vi.fn().mockResolvedValue(null),
}))

vi.mock('./voice/voice-integrations', () => ({
  handleVoiceMessage: handleVoiceMessageMock,
}))
vi.mock('./orchestrator', () => ({
  orchestrate: orchestrateMock,
}))
vi.mock('./agent-mode', () => ({
  handleActionConfirmation: handleActionConfirmationMock,
}))

import { handleUpdate } from './telegram'
import type { Env } from './env'

describe('handleUpdate — voice routing', () => {
  const env = { TELEGRAM_BOT_TOKEN: 'test-token' } as unknown as Env
  const originalFetch = global.fetch

  beforeEach(() => {
    handleVoiceMessageMock.mockClear()
    orchestrateMock.mockClear()
    handleActionConfirmationMock.mockClear()
    global.fetch = vi.fn().mockResolvedValue(new Response('ok')) as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('routes voice notes to the voice handler instead of the text orchestrator', async () => {
    const update = {
      message: {
        chat: { id: 42 },
        date: 0,
        voice: { file_id: 'abc', mime_type: 'audio/ogg', duration: 3, file_size: 1000 },
      },
    }

    await handleUpdate(update, env)

    expect(handleVoiceMessageMock).toHaveBeenCalledTimes(1)
    const [calledEnv, calledMessage] = handleVoiceMessageMock.mock.calls[0]
    expect(calledEnv).toBe(env)
    expect(calledMessage).toEqual({ chat: { id: 42 }, voice: update.message.voice })
    expect(orchestrateMock).not.toHaveBeenCalled()
  })

  it('still routes plain text through the text orchestrator', async () => {
    const update = { message: { chat: { id: 42 }, date: 0, text: 'hej' } }

    await handleUpdate(update, env)

    expect(handleVoiceMessageMock).not.toHaveBeenCalled()
    expect(orchestrateMock).toHaveBeenCalledWith('hej', 42, env)
  })
})
