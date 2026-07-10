import { describe, it, expect } from 'vitest'
import { decideToolPolicy } from './policy'
import type { PolicyContext, PolicyDecision } from './policy'

const mockHighRiskMetadata = {
  riskLevel: 'high' as const,
  sideEffect: true,
}

const mockCriticalMetadata = {
  riskLevel: 'critical' as const,
  sideEffect: true,
}

const mockLowRiskMetadata = {
  riskLevel: 'low' as const,
  sideEffect: false,
}

const mockMediumSideEffectMetadata = {
  riskLevel: 'medium' as const,
  sideEffect: true,
}

function assertApprovalRequired(decision: PolicyDecision, expectedReason?: string): void {
  expect(decision.type).toBe('require_approval')
  if (expectedReason && decision.type === 'require_approval') {
    expect(decision.reason).toContain(expectedReason)
  }
}

function assertDenied(decision: PolicyDecision, expectedReason?: string): void {
  expect(decision.type).toBe('deny')
  if (expectedReason && decision.type === 'deny') {
    expect(decision.reason).toContain(expectedReason)
  }
}

function assertAllowed(decision: PolicyDecision): void {
  expect(decision).toEqual({ type: 'allow' })
}

describe('Policy Engine — decideToolPolicy', () => {
  describe('High-risk tools require approval', () => {
    it('stripe_refund (critical + side-effect) requires approval', () => {
      const context: PolicyContext = {
        tool: {
          name: 'stripe_refund',
          metadata: mockCriticalMetadata,
        },
        agentMode: 'autonomous',
        env: undefined,
      }

      const decision = decideToolPolicy(context)

      assertApprovalRequired(decision, 'critical')
    })

    it('github_push_file (high + side-effect) requires approval', () => {
      const context: PolicyContext = {
        tool: {
          name: 'github_push_file',
          metadata: mockHighRiskMetadata,
        },
        agentMode: 'autonomous',
        env: undefined,
      }

      const decision = decideToolPolicy(context)

      assertApprovalRequired(decision, 'high')
    })

    it('email_send_reply (high + side-effect) requires approval', () => {
      const context: PolicyContext = {
        tool: {
          name: 'email_send_reply',
          metadata: mockHighRiskMetadata,
        },
        agentMode: 'autonomous',
        env: undefined,
      }

      const decision = decideToolPolicy(context)

      assertApprovalRequired(decision)
    })

    it('vercel_redeploy (high + side-effect) requires approval', () => {
      const context: PolicyContext = {
        tool: {
          name: 'vercel_redeploy',
          metadata: mockHighRiskMetadata,
        },
        agentMode: 'autonomous',
        env: undefined,
      }

      const decision = decideToolPolicy(context)

      assertApprovalRequired(decision)
    })

    it('github_create_issue (high + side-effect) requires approval', () => {
      const context: PolicyContext = {
        tool: {
          name: 'github_create_issue',
          metadata: mockHighRiskMetadata,
        },
        agentMode: 'autonomous',
        env: undefined,
      }

      const decision = decideToolPolicy(context)

      assertApprovalRequired(decision)
    })
  })

  describe('Medium-risk side-effect tools require approval', () => {
    it('medium side-effect tool requires approval', () => {
      const context: PolicyContext = {
        tool: {
          name: 'some_medium_tool',
          metadata: mockMediumSideEffectMetadata,
        },
        agentMode: 'autonomous',
        env: undefined,
      }

      const decision = decideToolPolicy(context)

      assertApprovalRequired(decision, 'medium')
    })
  })

  describe('Low-risk read-only tools allow', () => {
    it('web_search (low + no side-effect) is allowed', () => {
      const context: PolicyContext = {
        tool: {
          name: 'web_search',
          metadata: mockLowRiskMetadata,
        },
        agentMode: 'autonomous',
        env: undefined,
      }

      const decision = decideToolPolicy(context)

      assertAllowed(decision)
    })
  })

  describe('Agent mode: manual blocks all side-effects', () => {
    it('manual mode blocks high-risk side-effect', () => {
      const context: PolicyContext = {
        tool: {
          name: 'stripe_refund',
          metadata: mockCriticalMetadata,
        },
        agentMode: 'manual',
        env: undefined,
      }

      const decision = decideToolPolicy(context)

      assertDenied(decision, 'manual')
    })

    it('manual mode blocks medium side-effect', () => {
      const context: PolicyContext = {
        tool: {
          name: 'some_medium_tool',
          metadata: mockMediumSideEffectMetadata,
        },
        agentMode: 'manual',
        env: undefined,
      }

      const decision = decideToolPolicy(context)

      assertDenied(decision, 'manual')
    })

    it('manual mode still allows read-only tools', () => {
      const context: PolicyContext = {
        tool: {
          name: 'web_search',
          metadata: mockLowRiskMetadata,
        },
        agentMode: 'manual',
        env: undefined,
      }

      const decision = decideToolPolicy(context)

      assertAllowed(decision)
    })
  })

  describe('Confirm mode allows high-risk with approval', () => {
    it('confirm mode returns require_approval for high-risk', () => {
      const context: PolicyContext = {
        tool: {
          name: 'stripe_refund',
          metadata: mockCriticalMetadata,
        },
        agentMode: 'confirm',
        env: undefined,
      }

      const decision = decideToolPolicy(context)

      assertApprovalRequired(decision)
    })
  })

  describe('Kill switch: SIDE_EFFECTS_DISABLED blocks all side-effects', () => {
    it('blocks high-risk side-effect when SIDE_EFFECTS_DISABLED=true', () => {
      const context: PolicyContext = {
        tool: {
          name: 'stripe_refund',
          metadata: mockCriticalMetadata,
        },
        agentMode: 'autonomous',
        env: { SIDE_EFFECTS_DISABLED: 'true' } as any,
      }

      const decision = decideToolPolicy(context)

      assertDenied(decision, 'SIDE_EFFECTS_DISABLED')
    })

    it('blocks medium side-effect when SIDE_EFFECTS_DISABLED=true', () => {
      const context: PolicyContext = {
        tool: {
          name: 'some_medium_tool',
          metadata: mockMediumSideEffectMetadata,
        },
        agentMode: 'autonomous',
        env: { SIDE_EFFECTS_DISABLED: 'true' } as any,
      }

      const decision = decideToolPolicy(context)

      assertDenied(decision, 'SIDE_EFFECTS_DISABLED')
    })

    it('still allows read-only when SIDE_EFFECTS_DISABLED=true', () => {
      const context: PolicyContext = {
        tool: {
          name: 'web_search',
          metadata: mockLowRiskMetadata,
        },
        agentMode: 'autonomous',
        env: { SIDE_EFFECTS_DISABLED: 'true' } as any,
      }

      const decision = decideToolPolicy(context)

      assertAllowed(decision)
    })

    it('takes precedence over agent mode', () => {
      const context: PolicyContext = {
        tool: {
          name: 'stripe_refund',
          metadata: mockCriticalMetadata,
        },
        agentMode: 'autonomous',
        env: { SIDE_EFFECTS_DISABLED: 'true' } as any,
      }

      const decision = decideToolPolicy(context)

      assertDenied(decision, 'SIDE_EFFECTS_DISABLED')
    })

    it('handles case-insensitive true values', () => {
      const context: PolicyContext = {
        tool: {
          name: 'stripe_refund',
          metadata: mockCriticalMetadata,
        },
        agentMode: 'autonomous',
        env: { SIDE_EFFECTS_DISABLED: 'TRUE' } as any,
      }

      const decision = decideToolPolicy(context)

      expect(decision.type).toBe('deny')
    })
  })

  describe('Kill switch: READ_ONLY_MODE blocks side-effects', () => {
    it('blocks high-risk side-effect when READ_ONLY_MODE=true', () => {
      const context: PolicyContext = {
        tool: {
          name: 'stripe_refund',
          metadata: mockCriticalMetadata,
        },
        agentMode: 'autonomous',
        env: { READ_ONLY_MODE: 'true' } as any,
      }

      const decision = decideToolPolicy(context)

      assertDenied(decision, 'READ_ONLY_MODE')
    })

    it('blocks medium side-effect when READ_ONLY_MODE=true', () => {
      const context: PolicyContext = {
        tool: {
          name: 'some_medium_tool',
          metadata: mockMediumSideEffectMetadata,
        },
        agentMode: 'autonomous',
        env: { READ_ONLY_MODE: 'true' } as any,
      }

      const decision = decideToolPolicy(context)

      assertDenied(decision, 'READ_ONLY_MODE')
    })

    it('still allows read-only when READ_ONLY_MODE=true', () => {
      const context: PolicyContext = {
        tool: {
          name: 'web_search',
          metadata: mockLowRiskMetadata,
        },
        agentMode: 'autonomous',
        env: { READ_ONLY_MODE: 'true' } as any,
      }

      const decision = decideToolPolicy(context)

      assertAllowed(decision)
    })

    it('handles case-insensitive true values', () => {
      const context: PolicyContext = {
        tool: {
          name: 'stripe_refund',
          metadata: mockCriticalMetadata,
        },
        agentMode: 'autonomous',
        env: { READ_ONLY_MODE: 'True' } as any,
      }

      const decision = decideToolPolicy(context)

      expect(decision.type).toBe('deny')
    })
  })

  describe('Kill switch precedence: SIDE_EFFECTS_DISABLED > READ_ONLY_MODE > agent mode', () => {
    it('SIDE_EFFECTS_DISABLED takes precedence over READ_ONLY_MODE', () => {
      const context: PolicyContext = {
        tool: {
          name: 'stripe_refund',
          metadata: mockCriticalMetadata,
        },
        agentMode: 'autonomous',
        env: {
          READ_ONLY_MODE: 'false',
          SIDE_EFFECTS_DISABLED: 'true',
        } as any,
      }

      const decision = decideToolPolicy(context)

      assertDenied(decision, 'SIDE_EFFECTS_DISABLED')
    })

    it('READ_ONLY_MODE takes precedence over manual mode check', () => {
      const context: PolicyContext = {
        tool: {
          name: 'stripe_refund',
          metadata: mockCriticalMetadata,
        },
        agentMode: 'autonomous',
        env: { READ_ONLY_MODE: 'true' } as any,
      }

      const decision = decideToolPolicy(context)

      expect(decision.type).toBe('deny')
    })
  })
})
