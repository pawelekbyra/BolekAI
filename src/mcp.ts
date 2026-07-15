import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z, type ZodRawShape, type ZodTypeAny } from 'zod'
import type { Env } from './env'
import { tools, executeTool, type ToolDefinition } from './tools/index'

function jsonSchemaPropertyToZod(prop: { type: string; description: string }): ZodTypeAny {
  switch (prop.type) {
    case 'number':
      return z.number().describe(prop.description)
    case 'boolean':
      return z.boolean().describe(prop.description)
    case 'array':
      return z.array(z.string()).describe(prop.description)
    case 'object':
      return z.record(z.string(), z.unknown()).describe(prop.description)
    default:
      return z.string().describe(prop.description)
  }
}

function toolInputSchema(tool: ToolDefinition): ZodRawShape {
  const required = new Set(tool.parameters.required ?? [])
  const entries = Object.entries(tool.parameters.properties).map(([key, prop]) => {
    const zodType = jsonSchemaPropertyToZod(prop)
    return [key, required.has(key) ? zodType : zodType.optional()] as const
  })
  return Object.fromEntries(entries)
}

function buildMcpServer(env: Env, ownerChatId: number): McpServer {
  const server = new McpServer({ name: 'bolek-mcp-server', version: '1.0.0' })

  for (const tool of tools) {
    const sideEffect = tool.sideEffect ?? false
    server.registerTool(
      tool.name,
      {
        title: tool.name,
        description: tool.description,
        inputSchema: toolInputSchema(tool),
        annotations: {
          readOnlyHint: !sideEffect,
          destructiveHint: sideEffect,
          idempotentHint: !sideEffect,
          openWorldHint: true,
        },
      },
      async (args: unknown) => {
        try {
          const result = await executeTool(tool.name, args, env.DB, ownerChatId, env)
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          return { isError: true, content: [{ type: 'text' as const, text: `Error: ${message}` }] }
        }
      }
    )
  }

  return server
}

export async function handleMcpRequest(request: Request, env: Env): Promise<Response> {
  const ownerChatId = Number(env.BOLEK_OWNER_CHAT_ID ?? 0)
  const server = buildMcpServer(env, Number.isFinite(ownerChatId) ? ownerChatId : 0)

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  await server.connect(transport)
  return transport.handleRequest(request)
}
