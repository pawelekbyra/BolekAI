import type { ToolManifest } from './manifest'

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
export const toolManifests: Record<string, ToolManifest> = {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STRIPE (payments & financial operations)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  stripe_refund: {
    id: 'stripe_refund_v1',
    name: 'stripe_refund',
    version: '1.0.0',
    provider: 'stripe',
    description: 'Process a refund in Stripe (critical operation with approval gate)',
    inputSchema: {
      type: 'object',
      properties: {
        charge_id: { type: 'string', description: 'Stripe charge ID to refund' },
        amount: { type: 'number', description: 'Amount in cents (optional, full refund if omitted)' },
        reason: { type: 'string', description: 'Refund reason (customer_request, fraud, etc)' },
      },
      required: ['charge_id'],
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
    redactionRules: {
      fields: ['charge_id', 'refund_id', 'receipt_number'],
    },
    idempotency: {
      enabled: true,
      keyField: 'charge_id',
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
        message_id: { type: 'string', description: 'Email thread message ID' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body (plain text or HTML)' },
        to: { type: 'string', description: 'Recipient email address' },
      },
      required: ['message_id', 'subject', 'body', 'to'],
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
    redactionRules: {
      fields: ['api_key'],
      patterns: [/[\w\.-]+@[\w\.-]+\.\w+/g], // Email addresses
    },
    idempotency: {
      enabled: true,
      keyField: 'message_id',
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
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        path: { type: 'string', description: 'File path in repo' },
        content: { type: 'string', description: 'File content' },
        message: { type: 'string', description: 'Commit message' },
        branch: { type: 'string', description: 'Target branch (default: main)' },
      },
      required: ['owner', 'repo', 'path', 'content', 'message'],
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
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        title: { type: 'string', description: 'Issue title' },
        body: { type: 'string', description: 'Issue description' },
        labels: { type: 'string', description: 'Comma-separated labels' },
      },
      required: ['owner', 'repo', 'title', 'body'],
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
        project_name: { type: 'string', description: 'Vercel project name' },
        source: { type: 'string', description: 'Source (git, manual, etc)' },
      },
      required: ['project_name'],
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
    redactionRules: {
      fields: ['deployment_id'],
    },
    idempotency: {
      enabled: true,
      keyField: 'project_name',
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
    redactionRules: {
      fields: [],
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
    redactionRules: {
      fields: [],
    },
  },
}

/**
 * Get a manifest by tool name.
 */
export function getToolManifest(toolName: string): ToolManifest | undefined {
  return toolManifests[toolName]
}

/**
 * List all registered manifests.
 */
export function listToolManifests(): ToolManifest[] {
  return Object.values(toolManifests)
}

/**
 * Get manifests filtered by risk level.
 */
export function getManifestsByRiskLevel(riskLevel: string): ToolManifest[] {
  return listToolManifests().filter((m) => m.riskLevel === riskLevel)
}

/**
 * Get manifests filtered by side-effect.
 */
export function getManifestsBySideEffect(hasSideEffect: boolean): ToolManifest[] {
  return listToolManifests().filter((m) => m.sideEffect === hasSideEffect)
}
