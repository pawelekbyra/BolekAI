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
import { calendarTools, executeCalendarTool } from './calendar'
import { weatherTools, executeWeatherTool } from './weather'
import { memoryTools, executeMemoryTool } from './memory'
import { chatServiceTools, executeChatServiceTool } from './external/chat-service'
import { workflowServiceTools, executeWorkflowServiceTool } from './external/workflow-service'
import { knowledgeServiceTools, executeKnowledgeServiceTool } from './external/knowledge-service'
import type { Env } from '../env'
import type { ActionExecutionOptions } from '../agent-mode'

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
  ...stripeTools,
  ...clerkTools,
  ...polutekTools,
  ...emailTools,
  ...webTools,
  ...calendarTools,
  ...weatherTools,
  ...memoryTools,
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
  if (name.startsWith('calendar_'))  return executeCalendarTool(name, args, env!)
  if (name.startsWith('weather_'))   return executeWeatherTool(name, args, env!)
  if (name.startsWith('memory_'))    return executeMemoryTool(name, args, env!)
  // External services (tri-tier architecture)
  if (name.startsWith('chat_'))      return executeChatServiceTool(name, args, env!)
  if (name.startsWith('flow_'))      return executeWorkflowServiceTool(name, args, env!)
  if (name.startsWith('kb_'))        return executeKnowledgeServiceTool(name, args, env!)
  throw new Error(`Unknown tool: ${name}`)
}
