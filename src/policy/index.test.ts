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
      agentMode: 'confirm',
    }

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
