import type { ToolDefinition } from '../tools/index'
import { BaseConnector, type ConnectorManifest, type ConnectorExecutionResult } from './base'

const API = 'https://api.clerk.com/v1'

export class ClerkConnector extends BaseConnector {
  manifest: ConnectorManifest = {
    id: 'clerk_v1',
    name: 'clerk',
    version: '1.0.0',
    provider: 'Clerk',
    description: 'User authentication and management',
    scopes: ['users:read', 'users:manage'],
    riskProfile: {
      default: 'medium',
      byAction: {
        'clerk_list_users': 'low',
        'clerk_get_user': 'low',
        'clerk_ban_user': 'high',
      },
    },
    redactionRules: {
      globalFields: ['apiKey', 'token', 'secret'],
      patterns: [/sk_[a-zA-Z0-9_]+/gi],
      toolSpecific: {
        'clerk_get_user': ['primaryEmailAddress', 'phoneNumber'],
      },
    },
    auditEvents: {
      logSensitiveArgs: false,
      logResult: true,
      retentionDays: 90,
    },
    idempotency: {
      enabled: true,
      keyExtractor: (args: any) => `clerk-${args.userId}-${args.action}`,
    },
  }

  tools: ToolDefinition[] = [
    {
      name: 'clerk_list_users',
      riskLevel: 'low',
      sideEffect: false,
      description: 'List users',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Limit results' },
          offset: { type: 'number', description: 'Pagination offset' },
        },
      },
    },
    {
      name: 'clerk_get_user',
      riskLevel: 'low',
      sideEffect: false,
      description: 'Get user details',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID' },
        },
        required: ['userId'],
      },
    },
    {
      name: 'clerk_ban_user',
      riskLevel: 'high',
      sideEffect: true,
      description: 'Ban a user',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID' },
          reason: { type: 'string', description: 'Ban reason' },
        },
        required: ['userId'],
      },
    },
  ]

  async execute(toolName: string, args: unknown): Promise<ConnectorExecutionResult> {
    const start = Date.now()

    try {
      const apiKey = this.ctx.env['CLERK_API_KEY']
      if (!apiKey) throw new Error('CLERK_API_KEY not configured')

      let result
      switch (toolName) {
        case 'clerk_list_users':
          result = await this.listUsers(apiKey, args as any)
          break
        case 'clerk_get_user':
          result = await this.getUser(apiKey, args as any)
          break
        case 'clerk_ban_user':
          result = await this.banUser(apiKey, args as any)
          break
        default:
          throw new Error(`Unknown tool: ${toolName}`)
      }

      this.logAuditEvent({
        toolName,
        status: 'success',
        duration: Date.now() - start,
        resultPreview: JSON.stringify(result).slice(0, 100),
      })

      return { ok: true, data: this.redactOutput(result) }
    } catch (error) {
      const duration = Date.now() - start
      this.logAuditEvent({
        toolName,
        status: 'failure',
        duration,
        resultPreview: String(error),
      })
      return { ok: false, error: String(error) }
    }
  }

  private async listUsers(apiKey: string, args: any) {
    const params = new URLSearchParams()
    if (args.limit) params.append('limit', String(args.limit))
    if (args.offset) params.append('offset', String(args.offset))

    const res = await fetch(`${API}/users?${params.toString()}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) throw new Error(`Clerk ${res.status}`)
    return res.json()
  }

  private async getUser(apiKey: string, args: any) {
    const res = await fetch(`${API}/users/${args.userId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) throw new Error(`Clerk ${res.status}`)
    return res.json()
  }

  private async banUser(apiKey: string, args: any) {
    const res = await fetch(`${API}/users/${args.userId}/ban`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ reason: args.reason }),
    })
    if (!res.ok) throw new Error(`Clerk ${res.status}`)
    return res.json()
  }
}
