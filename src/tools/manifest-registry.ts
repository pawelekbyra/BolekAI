import type { ToolDefinition } from './index'
import type { RiskLevel } from '../security/types'
import type { ToolManifest, ToolDefaultPolicy, IdempotencyConfig } from './manifest'

/**
 * Central registry of all tool manifests.
 * Every tool that can be called must have a manifest entry here.
 *
 * Manifest structure:
 * - id: unique identifier with version (e.g., "stripe_refund_v1")
 * - name: dispatch name (must match tool.name in orchestrator)
 * - version: semantic version
 * - provider: source (stripe, github, internal, external-service, etc)
 * - riskLevel: low | medium | high | critical
 * - sideEffect: true if tool modifies state
 * - requiredScopes: permissions needed (e.g., ["user:repo", "stripe:write_refund"])
 * - redactionRules: what to mask in output
 * - idempotency: execution guarantee config
 */
export const explicitToolManifests: Record<string, ToolManifest> = {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STRIPE (payments & financial operations)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  stripe_refund: {
    id: 'stripe_refund_v1',
    name: 'stripe_refund',
    version: '1.0.0',
    provider: 'stripe',
    description: 'Process a refund via Polutek ops-API (critical operation with approval gate)',
    inputSchema: {
      type: 'object',
      properties: {
        paymentId: { type: 'string', description: 'Identyfikator płatności w Polutku/Stripe do refundu' },
        revokePatron: { type: 'boolean', description: 'Czy cofnąć patronat razem z refundem; domyślnie true' },
        reason: { type: 'string', description: 'Powód refundu do audytu operacyjnego' },
      },
      required: ['paymentId', 'reason'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        refund_id: { type: 'string' },
        status: { type: 'string' },
        amount_refunded: { type: 'number' },
      },
    },
    riskLevel: 'critical',
    sideEffect: true,
    requiredScopes: ['stripe:write_refund'],
    defaultPolicy: 'require_approval',
    redactionRules: {
      fields: ['paymentId'],
    },
    idempotency: {
      enabled: true,
      keyField: 'paymentId',
      ttl: 86400, // 24 hours
    },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EMAIL (outbound communication)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  email_send_reply: {
    id: 'email_send_reply_v1',
    name: 'email_send_reply',
    version: '1.0.0',
    provider: 'resend',
    description: 'Send an outbound email reply (high-risk: affects customer perception)',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        text: { type: 'string', description: 'Email body (plain text)' },
        inReplyTo: { type: 'string', description: 'Optional Message-ID of the original email' },
      },
      required: ['to', 'subject', 'text'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        sent: { type: 'boolean' },
        email_id: { type: 'string' },
        timestamp: { type: 'string' },
      },
    },
    riskLevel: 'high',
    sideEffect: true,
    requiredScopes: ['email:send'],
    defaultPolicy: 'require_approval',
    redactionRules: {
      fields: ['api_key'],
      patterns: [/[\w\.-]+@[\w\.-]+\.\w+/g], // Email addresses
    },
    idempotency: {
      enabled: true,
      keyField: 'inReplyTo',
      ttl: 3600, // 1 hour
    },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GITHUB (code repository operations)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  github_push_file: {
    id: 'github_push_file_v1',
    name: 'github_push_file',
    version: '1.0.0',
    provider: 'github',
    description: 'Create or update a file in a GitHub repository (high-risk: modifies source)',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in owner/repo format' },
        path: { type: 'string', description: 'File path in repo' },
        content: { type: 'string', description: 'File content' },
        message: { type: 'string', description: 'Commit message' },
        branch: { type: 'string', description: 'Target branch (default: main)' },
      },
      required: ['repo', 'path', 'content', 'message'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        sha: { type: 'string' },
        commit_url: { type: 'string' },
      },
    },
    riskLevel: 'high',
    sideEffect: true,
    requiredScopes: ['repo:write'],
    defaultPolicy: 'require_approval',
    redactionRules: {
      fields: [],
      patterns: [/token[=:]\s*[\w\-]+/gi], // Don't accidentally log tokens
    },
    idempotency: {
      enabled: true,
      keyField: 'message',
      ttl: 3600,
    },
  },

  github_create_issue: {
    id: 'github_create_issue_v1',
    name: 'github_create_issue',
    version: '1.0.0',
    provider: 'github',
    description: 'Create a new issue in a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in owner/repo format' },
        title: { type: 'string', description: 'Issue title' },
        body: { type: 'string', description: 'Issue description' },
      },
      required: ['repo', 'title'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        issue_number: { type: 'number' },
        url: { type: 'string' },
      },
    },
    riskLevel: 'high',
    sideEffect: true,
    requiredScopes: ['repo:write'],
    defaultPolicy: 'require_approval',
    redactionRules: {
      fields: [],
    },
    idempotency: {
      enabled: true,
      keyField: 'title',
      ttl: 3600,
    },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // VERCEL (deployment operations)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  vercel_redeploy: {
    id: 'vercel_redeploy_v1',
    name: 'vercel_redeploy',
    version: '1.0.0',
    provider: 'vercel',
    description: 'Trigger a redeploy of a Vercel project (high-risk: production deployment)',
    inputSchema: {
      type: 'object',
      properties: {
        deployment_id: { type: 'string', description: 'ID of the deployment to redeploy (from vercel_get_deployments)' },
      },
      required: ['deployment_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        deployment_id: { type: 'string' },
        status: { type: 'string' },
        url: { type: 'string' },
      },
    },
    riskLevel: 'high',
    sideEffect: true,
    requiredScopes: ['vercel:deploy'],
    defaultPolicy: 'require_approval',
    redactionRules: {
      fields: ['deployment_id'],
    },
    idempotency: {
      enabled: true,
      keyField: 'deployment_id',
      ttl: 300, // 5 minutes (deployments are quick)
    },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // WEB (read-only information retrieval)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  web_search: {
    id: 'web_search_v1',
    name: 'web_search',
    version: '1.0.0',
    provider: 'internal',
    description: 'Search the web for current information (read-only)',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Number of results (default: 5)' },
      },
      required: ['query'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              url: { type: 'string' },
              snippet: { type: 'string' },
            },
          },
        },
      },
    },
    riskLevel: 'low',
    sideEffect: false,
    requiredScopes: ['web:read'],
    defaultPolicy: 'allow',
    redactionRules: {
      fields: [],
    },
    idempotency: {
      enabled: false,
    },
  },

  web_fetch: {
    id: 'web_fetch_v1',
    name: 'web_fetch',
    version: '1.0.0',
    provider: 'internal',
    description: 'Fetch and parse content from a URL (read-only)',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
        parse: { type: 'string', description: 'Parse mode (text, html, json)' },
      },
      required: ['url'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        status: { type: 'number' },
      },
    },
    riskLevel: 'low',
    sideEffect: false,
    requiredScopes: ['web:read'],
    defaultPolicy: 'allow',
    redactionRules: {
      fields: [],
    },
    idempotency: {
      enabled: false,
    },
  },
}

// Backward-compatible alias for code/docs that refer to the explicit manifest map.
export const toolManifests = explicitToolManifests

function providerFromToolName(toolName: string): string {
  const [provider] = toolName.split('_')
  return provider || 'internal'
}

function defaultPolicyForTool(tool: ToolDefinition): ToolDefaultPolicy {
  const riskLevel = tool.riskLevel ?? 'low'
  const sideEffect = tool.sideEffect ?? false

  if (tool.requiresApproval || riskLevel === 'high' || riskLevel === 'critical') {
    return 'require_approval'
  }

  if (riskLevel === 'medium' && sideEffect) {
    return 'require_approval'
  }

  return 'allow'
}

function defaultIdempotencyForTool(tool: ToolDefinition): IdempotencyConfig {
  return {
    enabled: false,
  }
}

function manifestFromToolDefinition(tool: ToolDefinition): ToolManifest {
  const riskLevel: RiskLevel = tool.riskLevel ?? 'low'
  return {
    id: `${tool.name}_v1`,
    name: tool.name,
    version: '1.0.0',
    provider: providerFromToolName(tool.name),
    description: tool.description,
    inputSchema: tool.parameters,
    riskLevel,
    sideEffect: tool.sideEffect ?? false,
    requiredScopes: [],
    defaultPolicy: defaultPolicyForTool(tool),
    redactionRules: {
      fields: [],
    },
    idempotency: defaultIdempotencyForTool(tool),
  }
}

export function buildToolManifestRegistry(tools: ToolDefinition[]): Record<string, ToolManifest> {
  return Object.fromEntries(
    tools.map((tool) => [
      tool.name,
      {
        ...manifestFromToolDefinition(tool),
        ...explicitToolManifests[tool.name],
      },
    ])
  )
}

/**
 * Get a manifest by tool name.
 */
export function getToolManifest(toolName: string, sourceTools?: ToolDefinition[]): ToolManifest | undefined {
  if (sourceTools) return buildToolManifestRegistry(sourceTools)[toolName]
  return explicitToolManifests[toolName]
}

/**
 * List all registered manifests.
 */
export function listToolManifests(sourceTools?: ToolDefinition[]): ToolManifest[] {
  if (sourceTools) return Object.values(buildToolManifestRegistry(sourceTools))
  return Object.values(explicitToolManifests)
}

/**
 * Get manifests filtered by risk level.
 */
export function getManifestsByRiskLevel(riskLevel: string, sourceTools?: ToolDefinition[]): ToolManifest[] {
  return listToolManifests(sourceTools).filter((m) => m.riskLevel === riskLevel)
}

/**
 * Get manifests filtered by side-effect.
 */
export function getManifestsBySideEffect(hasSideEffect: boolean, sourceTools?: ToolDefinition[]): ToolManifest[] {
  return listToolManifests(sourceTools).filter((m) => m.sideEffect === hasSideEffect)
}
