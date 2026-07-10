import { taskTools, executeTaskTool } from './tasks'
import { noteTools, executeNoteTool } from './notes'
import { factTools, executeFactTool } from './facts'
import { reminderTools, executeReminderTool } from './reminders'
import { githubTools, executeGithubTool } from './github'
import { vercelTools, executeVercelTool } from './vercel'
import { codingTools, executeCodingTool } from './coding'
import { agentTools, executeAgentTool } from './agents'
import { characterTools, executeCharacterTool } from './characters'
import { stripeTools, executeStripeTool } from './stripe'
import { clerkTools, executeClerkTool } from './clerk'
import { polutekTools, executePolutekTool } from './polutek'
import { emailTools, executeEmailTool } from './email-imap-smtp'
import { webTools, executeWebTool } from './web'
import { chatServiceTools, executeChatServiceTool } from './external/chat-service'
import { workflowServiceTools, executeWorkflowServiceTool } from './external/workflow-service'
import { knowledgeServiceTools, executeKnowledgeServiceTool } from './external/knowledge-service'
import type { Env } from '../env'
import type { ActionExecutionOptions } from '../agent-mode'
import { getMode } from '../agent-mode'
import type { RiskLevel } from '../security/types'
import { decideToolPolicy } from '../security/policy'
export type { RiskLevel } from '../security/types'
export type { PolicyDecision } from '../security/policy'

export const DEFAULT_TOOL_RISK_LEVEL: RiskLevel = 'low'
export const DEFAULT_TOOL_SIDE_EFFECT = false

export type ToolDefinition = {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required?: string[]
  }
  riskLevel?: RiskLevel
  sideEffect?: boolean
  requiresApproval?: boolean
}

export type ToolSafetyMetadata = Required<Pick<ToolDefinition, 'riskLevel' | 'sideEffect'>> &
  Pick<ToolDefinition, 'requiresApproval'>

export function getToolSafetyMetadata(tool: ToolDefinition): ToolSafetyMetadata {
  return {
    riskLevel: tool.riskLevel ?? DEFAULT_TOOL_RISK_LEVEL,
    sideEffect: tool.sideEffect ?? DEFAULT_TOOL_SIDE_EFFECT,
    requiresApproval: tool.requiresApproval,
  }
}

export function isReadOnlyModeEnabled(env?: Pick<Env, 'READ_ONLY_MODE'>): boolean {
  return env?.READ_ONLY_MODE?.trim().toLowerCase() === 'true'
}

export function isSideEffectsDisabled(env?: Pick<Env, 'SIDE_EFFECTS_DISABLED'>): boolean {
  return env?.SIDE_EFFECTS_DISABLED?.trim().toLowerCase() === 'true'
}

export type ToolBlockedResult = {
  ok: false
  blocked: true
  reason: 'read_only_mode' | 'side_effects_disabled' | 'policy_deny' | 'requires_approval'
  tool: string
  message: string
}

function readOnlyBlockedResult(tool: ToolDefinition): ToolBlockedResult {
  return {
    ok: false,
    blocked: true,
    reason: 'read_only_mode',
    tool: tool.name,
    message: `READ_ONLY_MODE=true — nie wykonuję narzędzia ${tool.name}, bo ma sideEffect: true. Wyłącz READ_ONLY_MODE tylko świadomie, jeśli chcesz pozwolić na akcje zmieniające stan.`,
  }
}

function sideEffectsDisabledBlockedResult(tool: ToolDefinition): ToolBlockedResult {
  // Faza 5 (audit_events) will replace this with a real audit write; for now this is the
  // single choke point where a kill-switch block becomes visible for future audit wiring.
  console.warn(`[kill-switch] SIDE_EFFECTS_DISABLED=true blocked tool "${tool.name}"`)
  return {
    ok: false,
    blocked: true,
    reason: 'side_effects_disabled',
    tool: tool.name,
    message: `SIDE_EFFECTS_DISABLED=true — globalny kill switch blokuje narzędzie ${tool.name}, bo ma sideEffect: true. Wyłącz SIDE_EFFECTS_DISABLED tylko świadomie, jeśli chcesz pozwolić na akcje zmieniające stan.`,
  }
}

function policyBlockedResult(tool: ToolDefinition, reason: string): ToolBlockedResult {
  console.warn(`[policy] blocked tool "${tool.name}": ${reason}`)
  return {
    ok: false,
    blocked: true,
    reason: 'policy_deny',
    tool: tool.name,
    message: `Polityka bezpieczeństwa blokuje narzędzie ${tool.name}: ${reason}`,
  }
}

function requiresApprovalResult(tool: ToolDefinition, reason: string): ToolBlockedResult {
  console.warn(`[policy] tool "${tool.name}" requires approval: ${reason}`)
  return {
    ok: false,
    blocked: true,
    reason: 'requires_approval',
    tool: tool.name,
    message: `Narzędzie ${tool.name} wymaga potwierdzenia: ${reason}`,
  }
}

export const tools: ToolDefinition[] = [
  ...taskTools,
  ...noteTools,
  ...factTools,
  ...reminderTools,
  ...githubTools,
  ...vercelTools,
  ...codingTools,
  ...agentTools,
  ...characterTools,
  ...stripeTools,
  ...clerkTools,
  ...polutekTools,
  ...emailTools,
  ...webTools,
  // External services (tri-tier architecture)
  ...chatServiceTools,
  ...workflowServiceTools,
  ...knowledgeServiceTools,
]

export async function executeTool(
  name: string,
  args: unknown,
  db: D1Database,
  chatId = 0,
  env?: Env,
  options: ActionExecutionOptions = {}
): Promise<unknown> {
  const tool = tools.find((candidate) => candidate.name === name)

  // Policy check: must happen before any execution
  if (tool && !options.approved) {
    const agentMode = await getMode(db)
    const metadata = getToolSafetyMetadata(tool)
    const decision = decideToolPolicy({
      tool: { name: tool.name, metadata },
      agentMode,
      env,
    })

    if (decision.type === 'deny') {
      return policyBlockedResult(tool, decision.reason)
    }
    if (decision.type === 'require_approval') {
      return requiresApprovalResult(tool, decision.reason)
    }
    // decision.type === 'allow' continues below
  }

  if (name.startsWith('task_'))     return executeTaskTool(name, args, db)
  if (name.startsWith('note_'))     return executeNoteTool(name, args, db)
  if (name.startsWith('fact_'))     return executeFactTool(name, args, db)
  if (name.startsWith('reminder_')) return executeReminderTool(name, args, db, chatId)
  if (name.startsWith('github_'))   return executeGithubTool(name, args, env!, chatId, options)
  if (name.startsWith('vercel_'))   return executeVercelTool(name, args, env!, chatId, options)
  if (name.startsWith('coding_'))   return executeCodingTool(name, args, env!, chatId, options)
  if (name.startsWith('agent_'))     return executeAgentTool(name, args, env!, chatId)
  if (name.startsWith('character_')) return executeCharacterTool(name, args, env!, chatId)
  if (name.startsWith('stripe_'))    return executeStripeTool(name, args, env!, chatId, options)
  if (name.startsWith('clerk_'))     return executeClerkTool(name, args, env!)
  if (name.startsWith('polutek_'))   return executePolutekTool(name, args, env!)
  if (name.startsWith('email_'))     return executeEmailTool(name, args, env!, chatId, options)
  if (name.startsWith('web_'))       return executeWebTool(name, args, env)
  // External services (tri-tier architecture)
  if (name.startsWith('chat_'))      return executeChatServiceTool(name, args, env!)
  if (name.startsWith('flow_'))      return executeWorkflowServiceTool(name, args, env!)
  if (name.startsWith('kb_'))        return executeKnowledgeServiceTool(name, args, env!)
  throw new Error(`Unknown tool: ${name}`)
}
