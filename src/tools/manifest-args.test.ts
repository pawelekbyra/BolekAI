import { describe, expect, it } from 'vitest'
import { normalizeToolArgs, validateToolArgs } from './manifest'
import { prepareToolArgsForExecution, type ToolInvalidArgsResult, toolManifestRegistry } from './index'

describe('Tool argument validation and normalization', () => {
  it('normalizes arguments before execution', () => {
    const prepared = prepareToolArgsForExecution('web_search', {
      query: '  policy engine  ',
      limit: '5',
    })

    expect(prepared).toEqual({
      ok: true,
      args: {
        query: 'policy engine',
        limit: 5,
      },
    })
  })

  it('blocks execution when required args are missing', () => {
    const prepared = prepareToolArgsForExecution('web_search', { limit: 5 })

    expect(prepared.ok).toBe(false)
    expect((prepared as { ok: false; result: ToolInvalidArgsResult }).result).toMatchObject({
      ok: false,
      blocked: true,
      reason: 'invalid_args',
      tool: 'web_search',
      message: 'Nieprawidłowe argumenty dla narzędzia web_search: Missing required argument: "query"',
    })
  })

  it('does not coerce invalid numeric strings into numbers', () => {
    const manifest = toolManifestRegistry.web_search
    const normalized = normalizeToolArgs(manifest, { query: 'x', limit: '5oops' })
    const validation = validateToolArgs(manifest, normalized)

    expect(normalized).toEqual({ query: 'x', limit: '5oops' })
    expect(validation).toEqual({
      valid: false,
      error: 'Argument "limit" must be a finite number, got string',
    })
  })
})
