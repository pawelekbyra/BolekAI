import type { ToolDefinition } from '../tools/index'
import { BaseConnector, type ConnectorManifest, type ConnectorContext, type ConnectorExecutionResult } from './base'

const API = 'https://api.github.com'

export class GitHubConnector extends BaseConnector {
  manifest: ConnectorManifest = {
    id: 'github_v1',
    name: 'github',
    version: '1.0.0',
    provider: 'GitHub',
    description: 'GitHub repository and issue management',
    scopes: ['repo:read', 'repo:write'],
    riskProfile: {
      default: 'low',
      byAction: {
        'github_push_file': 'high',
        'github_create_issue': 'medium',
        'github_close_issue': 'medium',
      },
    },
    redactionRules: {
      globalFields: ['token', 'authorization'],
      patterns: [/token_[a-zA-Z0-9_]+/gi],
      toolSpecific: {
        'github_push_file': ['content'],
      },
    },
    auditEvents: {
      logSensitiveArgs: false,
      logResult: true,
      retentionDays: 90,
    },
    idempotency: {
      enabled: true,
      keyExtractor: (args: any) => `${args.repo}-${args.action}-${args.targetId}`,
    },
  }

  tools: ToolDefinition[] = [
    {
      name: 'github_list_repos',
      riskLevel: 'low',
      sideEffect: false,
      description: 'List GitHub repositories',
      parameters: {
        type: 'object',
        properties: {
          per_page: { type: 'number', description: 'Results per page' },
        },
      },
    },
    {
      name: 'github_get_issues',
      riskLevel: 'low',
      sideEffect: false,
      description: 'Get open issues from repository',
      parameters: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: 'Repository in owner/repo format' },
          state: { type: 'string', description: 'Issue state (open|closed|all)' },
        },
        required: ['repo'],
      },
    },
    {
      name: 'github_push_file',
      riskLevel: 'high',
      sideEffect: true,
      description: 'Push file to repository',
      parameters: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: 'Repository in owner/repo format' },
          path: { type: 'string', description: 'File path' },
          content: { type: 'string', description: 'File content' },
          message: { type: 'string', description: 'Commit message' },
        },
        required: ['repo', 'path', 'content', 'message'],
      },
    },
  ]

  async execute(toolName: string, args: unknown): Promise<ConnectorExecutionResult> {
    const start = Date.now()

    try {
      const token = this.ctx.env['GITHUB_TOKEN']
      if (!token) throw new Error('GITHUB_TOKEN not configured')

      let result
      switch (toolName) {
        case 'github_list_repos':
          result = await this.listRepos(token, args as any)
          break
        case 'github_get_issues':
          result = await this.getIssues(token, args as any)
          break
        case 'github_push_file':
          result = await this.pushFile(token, args as any)
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

  private async listRepos(token: string, args: any) {
    const res = await fetch(`${API}/user/repos?per_page=${args.per_page || 30}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`GitHub ${res.status}`)
    return res.json()
  }

  private async getIssues(token: string, args: any) {
    const state = args.state || 'open'
    const res = await fetch(`${API}/repos/${args.repo}/issues?state=${state}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`GitHub ${res.status}`)
    return res.json()
  }

  private async pushFile(token: string, args: any) {
    const [owner, repo] = args.repo.split('/')
    const path = args.path
    const content = Buffer.from(args.content).toString('base64')

    const res = await fetch(`${API}/repos/${args.repo}/contents/${path}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        message: args.message,
        content,
        committer: { name: 'Agent Bolek', email: 'bolek@localhost' },
      }),
    })

    if (!res.ok) throw new Error(`GitHub ${res.status}`)
    return res.json()
  }
}
