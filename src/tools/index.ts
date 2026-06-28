import { taskTools, executeTaskTool } from './tasks'
import { noteTools, executeNoteTool } from './notes'
import { factTools, executeFactTool } from './facts'
import { reminderTools, executeReminderTool } from './reminders'
import { githubTools, executeGithubTool } from './github'
import { vercelTools, executeVercelTool } from './vercel'
import { codingTools, executeCodingTool } from './coding'
import { agentTools, executeAgentTool } from './agents'
import { characterTools, executeCharacterTool } from './characters'
import type { Env } from '../env'

export type ToolDefinition = {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required?: string[]
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
]

export async function executeTool(
  name: string,
  args: unknown,
  db: D1Database,
  chatId = 0,
  env?: Env
): Promise<unknown> {
  if (name.startsWith('task_'))     return executeTaskTool(name, args, db)
  if (name.startsWith('note_'))     return executeNoteTool(name, args, db)
  if (name.startsWith('fact_'))     return executeFactTool(name, args, db)
  if (name.startsWith('reminder_')) return executeReminderTool(name, args, db, chatId)
  if (name.startsWith('github_'))   return executeGithubTool(name, args, env!, chatId)
  if (name.startsWith('vercel_'))   return executeVercelTool(name, args, env!, chatId)
  if (name.startsWith('coding_'))   return executeCodingTool(name, args, env!, chatId)
  if (name.startsWith('agent_'))     return executeAgentTool(name, args, env!, chatId)
  if (name.startsWith('character_')) return executeCharacterTool(name, args, env!, chatId)
  throw new Error(`Unknown tool: ${name}`)
}
