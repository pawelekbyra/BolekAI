import { taskTools, executeTaskTool } from './tasks'
import { noteTools, executeNoteTool } from './notes'

export type ToolDefinition = {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required?: string[]
  }
}

export type ToolHandler = (name: string, args: unknown, db: D1Database) => Promise<unknown>

export const tools: ToolDefinition[] = [
  ...taskTools,
  ...noteTools,
]

export async function executeTool(name: string, args: unknown, db: D1Database): Promise<unknown> {
  if (name.startsWith('task_')) return executeTaskTool(name, args, db)
  if (name.startsWith('note_')) return executeNoteTool(name, args, db)
  throw new Error(`Unknown tool: ${name}`)
}
