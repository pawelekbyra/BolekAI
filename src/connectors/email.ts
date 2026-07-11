import type { ToolDefinition } from '../tools/index'
import { BaseConnector, type ConnectorManifest, type ConnectorExecutionResult } from './base'

export class EmailConnector extends BaseConnector {
  manifest: ConnectorManifest = {
    id: 'email_v1',
    name: 'email',
    version: '1.0.0',
    provider: 'Email (IMAP/SMTP)',
    description: 'Email ingestion and sending',
    scopes: ['email:read', 'email:send'],
    riskProfile: {
      default: 'medium',
      byAction: {
        'email_send': 'medium',
        'email_send_bulk': 'high',
      },
    },
    redactionRules: {
      globalFields: ['password', 'token', 'apiKey'],
      patterns: [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g],
      toolSpecific: {
        'email_send': ['to', 'cc', 'bcc', 'body'],
      },
    },
    auditEvents: {
      logSensitiveArgs: false,
      logResult: true,
      retentionDays: 180,
    },
    idempotency: {
      enabled: true,
      keyExtractor: (args: any) => `email-${args.to}-${args.subject}`,
    },
  }

  tools: ToolDefinition[] = [
    {
      name: 'email_list_inbox',
      riskLevel: 'low',
      sideEffect: false,
      description: 'List inbox emails',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of emails' },
          unreadOnly: { type: 'boolean', description: 'Only unread' },
        },
      },
    },
    {
      name: 'email_send',
      riskLevel: 'medium',
      sideEffect: true,
      description: 'Send email',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient email' },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Email body' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
    {
      name: 'email_send_bulk',
      riskLevel: 'high',
      sideEffect: true,
      description: 'Send bulk emails',
      parameters: {
        type: 'object',
        properties: {
          recipients: { type: 'array', description: 'Email list' },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Email body' },
        },
        required: ['recipients', 'subject', 'body'],
      },
    },
  ]

  async execute(toolName: string, args: unknown): Promise<ConnectorExecutionResult> {
    const start = Date.now()

    try {
      const imapUser = this.ctx.env['EMAIL_IMAP_USER']
      const imapPass = this.ctx.env['EMAIL_IMAP_PASS']
      if (!imapUser || !imapPass) throw new Error('EMAIL credentials not configured')

      let result
      switch (toolName) {
        case 'email_list_inbox':
          result = await this.listInbox(args as any)
          break
        case 'email_send':
          result = await this.sendEmail(args as any)
          break
        case 'email_send_bulk':
          result = await this.sendBulk(args as any)
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

  private async listInbox(args: any) {
    return {
      emails: [],
      count: 0,
      unreadCount: 0,
    }
  }

  private async sendEmail(args: any) {
    return {
      messageId: `msg_${Date.now()}`,
      sent: true,
      to: args.to,
      subject: args.subject,
    }
  }

  private async sendBulk(args: any) {
    return {
      sent: args.recipients.length,
      failed: 0,
      recipients: args.recipients.length,
    }
  }
}
