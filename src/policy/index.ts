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

export type PolicyProjectAllowlist = {
  projectIds?: string[]
  projectNames?: string[]
  targetTypes?: string[]
  targetIds?: string[]
}

export type ProjectAllowlistEvaluation = {
  configured: boolean
  projectMatched?: boolean
  targetMatched?: boolean
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
  projectAllowlist?: PolicyProjectAllowlist
}

function isReadOnlyModeEnabled(env?: Pick<Env, 'READ_ONLY_MODE'>): boolean {
  return env?.READ_ONLY_MODE?.trim().toLowerCase() === 'true'
}

function isSideEffectsDisabled(env?: Pick<Env, 'SIDE_EFFECTS_DISABLED'>): boolean {
  return env?.SIDE_EFFECTS_DISABLED?.trim().toLowerCase() === 'true'
}

function matchesOptionalAllowlist(value: string | undefined, allowlist: string[] | undefined): boolean | undefined {
  if (!allowlist || allowlist.length === 0) return undefined
  return value !== undefined && allowlist.includes(value)
}

export function evaluateProjectAllowlist(context: PolicyContext): ProjectAllowlistEvaluation {
  const allowlist = context.projectAllowlist

  if (!allowlist) {
    return { configured: false }
  }

  const projectIdMatched = matchesOptionalAllowlist(context.projectScope?.projectId, allowlist.projectIds)
  const projectNameMatched = matchesOptionalAllowlist(context.projectScope?.projectName, allowlist.projectNames)
  const targetTypeMatched = matchesOptionalAllowlist(context.target?.type, allowlist.targetTypes)
  const targetIdMatched = matchesOptionalAllowlist(context.target?.id, allowlist.targetIds)

  return {
    configured: true,
    projectMatched: projectIdMatched ?? projectNameMatched,
    targetMatched: targetTypeMatched ?? targetIdMatched,
  }
}

export type RiskLevelPolicyInput = {
  toolName: string
  riskLevel: RiskLevel
  sideEffect: boolean
}

export function decideRiskLevelPolicy(input: RiskLevelPolicyInput): PolicyDecision {
  const { toolName, riskLevel, sideEffect } = input

  switch (riskLevel) {
    case 'low':
      return { type: 'allow' }
    case 'medium':
      return sideEffect
        ? {
            type: 'require_approval',
            reason: `Tool "${toolName}" has medium risk and side-effect, requires approval`,
          }
        : { type: 'allow' }
    case 'high':
    case 'critical':
      return {
        type: 'require_approval',
        reason: `Tool "${toolName}" has risk level ${riskLevel} and requires approval`,
      }
    default: {
      const exhaustiveCheck: never = riskLevel
      return exhaustiveCheck
    }
  }
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

  return decideRiskLevelPolicy({
    toolName: tool.name,
    riskLevel,
    sideEffect,
  })
}
