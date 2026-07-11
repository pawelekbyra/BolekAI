import { describe, expect, it } from 'vitest'
import { decideRiskLevelPolicy, decideToolPolicy, evaluateProjectAllowlist, type PolicyContext } from './index'

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


describe('Risk-level policies', () => {
  it('allows low-risk tools explicitly', () => {
    expect(decideRiskLevelPolicy({ toolName: 'web_search', riskLevel: 'low', sideEffect: false })).toEqual({
      type: 'allow',
    })
  })

  it('allows medium read-only tools explicitly', () => {
    expect(decideRiskLevelPolicy({ toolName: 'report_preview', riskLevel: 'medium', sideEffect: false })).toEqual({
      type: 'allow',
    })
  })

  it('requires approval for medium side-effect tools explicitly', () => {
    expect(decideRiskLevelPolicy({ toolName: 'task_add', riskLevel: 'medium', sideEffect: true })).toMatchObject({
      type: 'require_approval',
    })
  })

  it('requires approval for high-risk tools explicitly', () => {
    expect(decideRiskLevelPolicy({ toolName: 'email_send_reply', riskLevel: 'high', sideEffect: true })).toMatchObject({
      type: 'require_approval',
    })
  })

  it('requires approval for critical-risk tools explicitly', () => {
    expect(decideRiskLevelPolicy({ toolName: 'stripe_refund', riskLevel: 'critical', sideEffect: true })).toMatchObject({
      type: 'require_approval',
    })
  })
})

describe('Project allowlist preparation', () => {
  it('evaluates project and target allowlist matches without enforcing a full project model', () => {
    const context: PolicyContext = {
      tool: {
        name: 'github_push_file',
        metadata: {
          riskLevel: 'high',
          sideEffect: true,
        },
      },
      agentMode: 'confirm',
      target: { type: 'github', id: 'github_push_file' },
      projectScope: { projectId: 'bolek-ai', projectName: 'BolekAI' },
      projectAllowlist: {
        projectIds: ['bolek-ai'],
        targetTypes: ['github'],
      },
    }

    expect(evaluateProjectAllowlist(context)).toEqual({
      configured: true,
      projectMatched: true,
      targetMatched: true,
    })
  })

  it('reports unconfigured allowlists without changing policy behavior', () => {
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

    expect(evaluateProjectAllowlist(context)).toEqual({ configured: false })
    expect(decideToolPolicy(context)).toEqual({ type: 'allow' })
  })
})
