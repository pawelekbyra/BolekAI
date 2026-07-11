import type { ToolDefinition } from '../tools/index'
import { BaseConnector, type ConnectorManifest, type ConnectorContext, type ConnectorExecutionResult } from './base'

const API = 'https://api.vercel.com'

export class VercelConnector extends BaseConnector {
  manifest: ConnectorManifest = {
    id: 'vercel_v1',
    name: 'vercel',
    version: '1.0.0',
    provider: 'Vercel',
    description: 'Vercel deployment and project management',
    scopes: ['projects:read', 'deployments:read', 'deployments:write'],
    riskProfile: {
      default: 'low',
      byAction: {
        'vercel_trigger_deploy': 'high',
        'vercel_rollback': 'critical',
      },
    },
    redactionRules: {
      globalFields: ['token', 'authorization', 'apiKey'],
      patterns: [/token_[a-zA-Z0-9_]+/gi],
      toolSpecific: {},
    },
    auditEvents: {
      logSensitiveArgs: false,
      logResult: true,
      retentionDays: 90,
    },
    idempotency: {
      enabled: true,
      keyExtractor: (args: any) => `vercel-${args.projectId}-${args.action}`,
    },
  }

  tools: ToolDefinition[] = [
    {
      name: 'vercel_list_projects',
      riskLevel: 'low',
      sideEffect: false,
      description: 'List Vercel projects',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'vercel_get_deployments',
      riskLevel: 'low',
      sideEffect: false,
      description: 'Get deployments for a project',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          limit: { type: 'number', description: 'Limit results' },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'vercel_trigger_deploy',
      riskLevel: 'high',
      sideEffect: true,
      description: 'Trigger a deployment',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          gitBranch: { type: 'string', description: 'Git branch to deploy' },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'vercel_rollback',
      riskLevel: 'critical',
      sideEffect: true,
      description: 'Rollback to previous deployment',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          deploymentId: { type: 'string', description: 'Previous deployment ID' },
        },
        required: ['projectId', 'deploymentId'],
      },
    },
  ]

  async execute(toolName: string, args: unknown): Promise<ConnectorExecutionResult> {
    const start = Date.now()

    try {
      const token = this.ctx.env['VERCEL_TOKEN']
      if (!token) throw new Error('VERCEL_TOKEN not configured')

      let result
      switch (toolName) {
        case 'vercel_list_projects':
          result = await this.listProjects(token)
          break
        case 'vercel_get_deployments':
          result = await this.getDeployments(token, args as any)
          break
        case 'vercel_trigger_deploy':
          result = await this.triggerDeploy(token, args as any)
          break
        case 'vercel_rollback':
          result = await this.rollback(token, args as any)
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

  private async listProjects(token: string) {
    const res = await fetch(`${API}/v9/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Vercel ${res.status}`)
    return res.json()
  }

  private async getDeployments(token: string, args: any) {
    const limit = args.limit || 10
    const res = await fetch(`${API}/v6/deployments?projectId=${args.projectId}&limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Vercel ${res.status}`)
    return res.json()
  }

  private async triggerDeploy(token: string, args: any) {
    const res = await fetch(`${API}/v13/deployments?projectId=${args.projectId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ gitBranch: args.gitBranch || 'main' }),
    })
    if (!res.ok) throw new Error(`Vercel ${res.status}`)
    return res.json()
  }

  private async rollback(token: string, args: any) {
    const res = await fetch(`${API}/v13/deployments/${args.deploymentId}/rollback?projectId=${args.projectId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Vercel ${res.status}`)
    return res.json()
  }
}
