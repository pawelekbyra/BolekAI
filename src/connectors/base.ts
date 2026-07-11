import type { ToolDefinition } from '../tools/index'

export interface ConnectorManifest {
  id: string
  name: string
  version: string
  provider: string
  description: string
  scopes: string[]
  riskProfile: {
    default: 'low' | 'medium' | 'high' | 'critical'
    byAction: Record<string, 'low' | 'medium' | 'high' | 'critical'>
  }
  redactionRules: {
    globalFields: string[]
    patterns: RegExp[]
    toolSpecific: Record<string, string[]>
  }
  auditEvents: {
    logSensitiveArgs: boolean
    logResult: boolean
    retentionDays: number
  }
  idempotency: {
    enabled: boolean
    keyExtractor?: (args: unknown) => string
  }
}

export interface ConnectorContext {
  env: Record<string, string>
  chatId?: number
  mode?: 'manual' | 'confirm' | 'autonomous'
}

export interface ConnectorExecutionResult {
  ok: boolean
  data?: unknown
  error?: string
  auditData?: {
    toolName: string
    status: 'success' | 'failure'
    duration: number
    argsPreview?: string
    resultPreview?: string
  }
}

export abstract class BaseConnector {
  abstract manifest: ConnectorManifest
  abstract tools: ToolDefinition[]

  constructor(protected ctx: ConnectorContext) {}

  abstract execute(toolName: string, args: unknown): Promise<ConnectorExecutionResult>

  redactOutput(data: unknown): unknown {
    if (typeof data !== 'object' || data === null) return data

    const obj = { ...data } as Record<string, unknown>

    for (const field of this.manifest.redactionRules.globalFields) {
      if (field in obj) {
        obj[field] = '[REDACTED]'
      }
    }

    for (const pattern of this.manifest.redactionRules.patterns) {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          obj[key] = value.replace(pattern, '[REDACTED]')
        }
      }
    }

    return obj
  }

  logAuditEvent(event: {
    toolName: string
    status: 'success' | 'failure' | 'pending'
    duration?: number
    argsPreview?: string
    resultPreview?: string
  }): void {
    if (this.manifest.auditEvents.logResult) {
      console.log(JSON.stringify({
        type: 'connector_audit',
        connector: this.manifest.name,
        timestamp: new Date().toISOString(),
        ...event,
      }))
    }
  }
}
