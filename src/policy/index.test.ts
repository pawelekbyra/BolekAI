import { describe, expect, it } from 'vitest'
import { decideToolPolicy, type PolicyContext } from './index'

describe('Policy central export', () => {
  it('allows low-risk read-only tools from src/policy', () => {
    const context: PolicyContext = {
      tool: {
        name: 'web_search',
        metadata: {
          riskLevel: 'low',
          sideEffect: false,
        },
      },
      args: { query: 'policy' },
      chatId: 123,
      agentMode: 'confirm',
      target: { type: 'internal', id: 'web_search' },
      projectScope: { projectName: 'bolek' },
    }

    expect(context.args).toEqual({ query: 'policy' })
    expect(context.chatId).toBe(123)
    expect(context.target).toEqual({ type: 'internal', id: 'web_search' })
    expect(context.projectScope).toEqual({ projectName: 'bolek' })
    expect(decideToolPolicy(context)).toEqual({ type: 'allow' })
  })

  it('keeps kill-switch behavior in the central policy module', () => {
    const context: PolicyContext = {
      tool: {
        name: 'task_add',
        metadata: {
          riskLevel: 'medium',
          sideEffect: true,
        },
      },
      agentMode: 'confirm',
      env: { SIDE_EFFECTS_DISABLED: 'true' } as any,
    }

    expect(decideToolPolicy(context)).toMatchObject({ type: 'deny' })
  })
})
