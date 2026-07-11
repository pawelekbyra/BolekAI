import type { ToolDefinition } from '../tools/index'
import { BaseConnector, type ConnectorManifest, type ConnectorExecutionResult } from './base'

const API = 'https://api.stripe.com/v1'

export class StripeConnector extends BaseConnector {
  manifest: ConnectorManifest = {
    id: 'stripe_v1',
    name: 'stripe',
    version: '1.0.0',
    provider: 'Stripe',
    description: 'Payment processing and financial operations',
    scopes: ['read:charges', 'read:customers', 'write:refunds'],
    riskProfile: {
      default: 'high',
      byAction: {
        'stripe_get_balance': 'low',
        'stripe_list_charges': 'low',
        'stripe_refund': 'critical',
      },
    },
    redactionRules: {
      globalFields: ['apiKey', 'token', 'secret'],
      patterns: [/sk_[a-zA-Z0-9_]+/gi, /pk_[a-zA-Z0-9_]+/gi],
      toolSpecific: {
        'stripe_refund': ['chargeId'],
      },
    },
    auditEvents: {
      logSensitiveArgs: false,
      logResult: true,
      retentionDays: 365,
    },
    idempotency: {
      enabled: true,
      keyExtractor: (args: any) => `stripe-${args.chargeId}-refund`,
    },
  }

  tools: ToolDefinition[] = [
    {
      name: 'stripe_get_balance',
      riskLevel: 'low',
      sideEffect: false,
      description: 'Get Stripe account balance',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'stripe_list_charges',
      riskLevel: 'low',
      sideEffect: false,
      description: 'List recent charges',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of charges' },
          customerId: { type: 'string', description: 'Filter by customer' },
        },
      },
    },
    {
      name: 'stripe_get_customer',
      riskLevel: 'low',
      sideEffect: false,
      description: 'Get customer details',
      parameters: {
        type: 'object',
        properties: {
          customerId: { type: 'string', description: 'Customer ID' },
        },
        required: ['customerId'],
      },
    },
    {
      name: 'stripe_refund',
      riskLevel: 'critical',
      sideEffect: true,
      description: 'Refund a charge',
      parameters: {
        type: 'object',
        properties: {
          chargeId: { type: 'string', description: 'Charge ID' },
          amount: { type: 'number', description: 'Refund amount in cents' },
          reason: { type: 'string', description: 'Refund reason' },
        },
        required: ['chargeId'],
      },
    },
  ]

  async execute(toolName: string, args: unknown): Promise<ConnectorExecutionResult> {
    const start = Date.now()

    try {
      const apiKey = this.ctx.env['STRIPE_API_KEY']
      if (!apiKey) throw new Error('STRIPE_API_KEY not configured')

      let result
      switch (toolName) {
        case 'stripe_get_balance':
          result = await this.getBalance(apiKey)
          break
        case 'stripe_list_charges':
          result = await this.listCharges(apiKey, args as any)
          break
        case 'stripe_get_customer':
          result = await this.getCustomer(apiKey, args as any)
          break
        case 'stripe_refund':
          result = await this.refund(apiKey, args as any)
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

  private async getBalance(apiKey: string) {
    const res = await fetch(`${API}/balance`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) throw new Error(`Stripe ${res.status}`)
    return res.json()
  }

  private async listCharges(apiKey: string, args: any) {
    let url = `${API}/charges?limit=${args.limit || 10}`
    if (args.customerId) url += `&customer=${args.customerId}`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) throw new Error(`Stripe ${res.status}`)
    return res.json()
  }

  private async getCustomer(apiKey: string, args: any) {
    const res = await fetch(`${API}/customers/${args.customerId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) throw new Error(`Stripe ${res.status}`)
    return res.json()
  }

  private async refund(apiKey: string, args: any) {
    const body: Record<string, unknown> = { charge: args.chargeId }
    if (args.amount) body.amount = args.amount
    if (args.reason) body.reason = args.reason

    const res = await fetch(`${API}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body as any).toString(),
    })
    if (!res.ok) throw new Error(`Stripe ${res.status}`)
    return res.json()
  }
}
