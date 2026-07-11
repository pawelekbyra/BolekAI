import { describe, expect, it } from 'vitest'
import { redactToolOutput, type ToolManifest } from './manifest'
import { redactToolResult } from './index'

const testManifest: ToolManifest = {
  id: 'test_tool_v1',
  name: 'test_tool',
  version: '1.0.0',
  provider: 'test',
  description: 'Test manifest',
  inputSchema: { type: 'object', properties: {} },
  riskLevel: 'low',
  sideEffect: false,
  requiredScopes: [],
  defaultPolicy: 'allow',
  redactionRules: {
    fields: ['customerEmail'],
    patterns: [/secret-[a-z0-9]+/gi],
  },
  idempotency: { enabled: false },
}

describe('Tool output redaction', () => {
  it('redacts global sensitive fields recursively', () => {
    const output = redactToolOutput(testManifest, {
      token: 'tok_123',
      nested: {
        password: 'hunter2',
        videoUrl: 'https://example.com/private-video',
      },
    })

    expect(output).toEqual({
      token: '[REDACTED]',
      nested: {
        password: '[REDACTED]',
        videoUrl: '[REDACTED]',
      },
    })
  })

  it('applies tool-specific fields and regex patterns', () => {
    const output = redactToolOutput(testManifest, {
      customerEmail: 'owner@example.com',
      message: 'temporary key secret-abc123 should not leak',
    })

    expect(output).toEqual({
      customerEmail: '[REDACTED]',
      message: 'temporary key [REDACTED] should not leak',
    })
  })

  it('redacts through the dispatcher output hook by tool name', () => {
    const output = redactToolResult('email_send_reply', {
      sent: true,
      api_key: 'resend_secret',
      to: 'customer@example.com',
    })

    expect(output).toEqual({
      sent: true,
      api_key: '[REDACTED]',
      to: '[REDACTED]',
    })
  })
})
