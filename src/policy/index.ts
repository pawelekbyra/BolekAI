import type { Env } from '../env'
import type { AgentMode } from '../agent-mode'
import type { RiskLevel, PolicyDecision } from '../security/types'

export type { PolicyDecision, RiskLevel } from '../security/types'

export type PolicyToolMetadata = {
  riskLevel: RiskLevel
  sideEffect: boolean
  requiresApproval?: boolean
}

export type PolicyTarget = {
  type: string
  id?: string
  displayName?: string
}

export type PolicyProjectScope = {
  projectId?: string
  projectName?: string
  environment?: string
}

export interface PolicyContext {
  tool: {
    name: string
    metadata: PolicyToolMetadata
  }
  args?: unknown
  chatId?: number
  agentMode: AgentMode
  env?: Env
  target?: PolicyTarget
  projectScope?: PolicyProjectScope
}

function isReadOnlyModeEnabled(env?: Pick<Env, 'READ_ONLY_MODE'>): boolean {
  return env?.READ_ONLY_MODE?.trim().toLowerCase() === 'true'
}

function isSideEffectsDisabled(env?: Pick<Env, 'SIDE_EFFECTS_DISABLED'>): boolean {
  return env?.SIDE_EFFECTS_DISABLED?.trim().toLowerCase() === 'true'
}

export function decideToolPolicy(context: PolicyContext): PolicyDecision {
  const { tool, agentMode, env } = context
  const { riskLevel, sideEffect } = tool.metadata

  // Kill switches: global SIDE_EFFECTS_DISABLED takes precedence
  if (sideEffect && isSideEffectsDisabled(env)) {
    return {
      type: 'deny',
      reason: `Globalny kill switch SIDE_EFFECTS_DISABLED=true blokuje side-effect tool "${tool.name}"`,
    }
  }

  // Kill switch: READ_ONLY_MODE blocks side-effects
  if (sideEffect && isReadOnlyModeEnabled(env)) {
    return {
      type: 'deny',
      reason: `READ_ONLY_MODE=true blokuje side-effect tool "${tool.name}"`,
    }
  }

  // Agent mode: manual mode blocks all side-effects
  if (sideEffect && agentMode === 'manual') {
    return {
      type: 'deny',
      reason: `Tryb manual blokuje side-effect tool "${tool.name}"`,
    }
  }

  // Risk-based policy
  // Low-risk read-only: always allow
  if (riskLevel === 'low' && !sideEffect) {
    return { type: 'allow' }
  }

  // High and critical always require approval
  if (riskLevel === 'high' || riskLevel === 'critical') {
    return {
      type: 'require_approval',
      reason: `Tool "${tool.name}" has risk level ${riskLevel} and requires approval`,
    }
  }

  // Medium risk with side-effect: require approval
  if (riskLevel === 'medium' && sideEffect) {
    return {
      type: 'require_approval',
      reason: `Tool "${tool.name}" has medium risk and side-effect, requires approval`,
    }
  }

  // Default: allow (low-risk, or medium read-only)
  return { type: 'allow' }
}
