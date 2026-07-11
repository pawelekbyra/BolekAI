import { describe, expect, it, beforeEach } from 'vitest'
import { GitHubConnector } from './github'
import { StripeConnector } from './stripe'
import { VercelConnector } from './vercel'
import { EmailConnector } from './email'
import { ClerkConnector } from './clerk'
import { PolutekConnector } from './polutek'

describe('Connectors', () => {
  describe('GitHub Connector', () => {
    it('has correct manifest', () => {
      const connector = new GitHubConnector({ env: {} })
      expect(connector.manifest.name).toBe('github')
      expect(connector.manifest.version).toBe('1.0.0')
      expect(connector.manifest.scopes).toContain('repo:read')
    })

    it('exposes GitHub tools', () => {
      const connector = new GitHubConnector({ env: {} })
      const toolNames = connector.tools.map((t) => t.name)
      expect(toolNames).toContain('github_list_repos')
      expect(toolNames).toContain('github_push_file')
    })

    it('has risk level for critical operations', () => {
      const connector = new GitHubConnector({ env: {} })
      expect(connector.manifest.riskProfile.byAction['github_push_file']).toBe('high')
    })

    it('redacts sensitive patterns', () => {
      const connector = new GitHubConnector({ env: {} })
      const result = connector.redactOutput({
        token: 'token_secret123',
        content: 'regular data',
      }) as Record<string, unknown>
      expect(result).toEqual({
        token: '[REDACTED]',
        content: 'regular data',
      })
    })
  })

  describe('Stripe Connector', () => {
    it('has critical risk for refunds', () => {
      const connector = new StripeConnector({ env: {} })
      expect(connector.manifest.riskProfile.byAction['stripe_refund']).toBe('critical')
    })

    it('has high default risk level', () => {
      const connector = new StripeConnector({ env: {} })
      expect(connector.manifest.riskProfile.default).toBe('high')
    })

    it('redacts API keys', () => {
      const connector = new StripeConnector({ env: {} })
      const result = connector.redactOutput({
        sk_test_123: 'secret',
        amount: 1000,
      }) as Record<string, unknown>
      expect(result.sk_test_123).toBe('[REDACTED]')
      expect(result.amount).toBe(1000)
    })
  })

  describe('Vercel Connector', () => {
    it('has rollback as critical operation', () => {
      const connector = new VercelConnector({ env: {} })
      expect(connector.manifest.riskProfile.byAction['vercel_rollback']).toBe('critical')
    })

    it('tracks deployments with high risk', () => {
      const connector = new VercelConnector({ env: {} })
      expect(connector.manifest.riskProfile.byAction['vercel_trigger_deploy']).toBe('high')
    })
  })

  describe('Email Connector', () => {
    it('redacts email addresses', () => {
      const connector = new EmailConnector({ env: {} })
      const result = connector.redactOutput({
        to: 'user@example.com',
        body: 'Contact me at admin@example.com',
      }) as Record<string, unknown>
      expect(result.to).toBe('[REDACTED]')
      expect(String(result.body)).toContain('[REDACTED]')
    })

    it('has medium default risk', () => {
      const connector = new EmailConnector({ env: {} })
      expect(connector.manifest.riskProfile.default).toBe('medium')
    })
  })

  describe('Clerk Connector', () => {
    it('has medium default risk', () => {
      const connector = new ClerkConnector({ env: {} })
      expect(connector.manifest.riskProfile.default).toBe('medium')
    })

    it('classifies ban_user as high risk', () => {
      const connector = new ClerkConnector({ env: {} })
      expect(connector.manifest.riskProfile.byAction['clerk_ban_user']).toBe('high')
    })
  })

  describe('Polutek Connector', () => {
    it('has critical risk for refunds', () => {
      const connector = new PolutekConnector({ env: {} })
      expect(connector.manifest.riskProfile.byAction['polutek_process_refund']).toBe('critical')
    })

    it('redacts patron data', () => {
      const connector = new PolutekConnector({ env: {} })
      const result = connector.redactOutput(
        {
          email: 'patron@example.com',
          paymentMethod: 'cc_4242',
          patronId: '123',
        },
        'polutek_get_patron'
      ) as Record<string, unknown>
      expect(result.email).toBe('[REDACTED]')
      expect(result.paymentMethod).toBe('[REDACTED]')
      expect(result.patronId).toBe('123')
    })

    it('has high retention for audit events', () => {
      const connector = new PolutekConnector({ env: {} })
      expect(connector.manifest.auditEvents.retentionDays).toBe(365)
    })
  })

  describe('All Connectors', () => {
    const connectorClasses = [
      GitHubConnector,
      StripeConnector,
      VercelConnector,
      EmailConnector,
      ClerkConnector,
      PolutekConnector,
    ]

    it.each(connectorClasses)('%s has valid manifest', (ConnectorClass) => {
      const connector = new ConnectorClass({ env: {} })
      const manifest = connector.manifest

      expect(manifest.id).toBeDefined()
      expect(manifest.name).toBeDefined()
      expect(manifest.version).toBeDefined()
      expect(manifest.scopes).toBeDefined()
      expect(manifest.riskProfile.default).toBeDefined()
      expect(manifest.redactionRules).toBeDefined()
      expect(manifest.auditEvents).toBeDefined()
    })

    it.each(connectorClasses)('%s exposes tools', (ConnectorClass) => {
      const connector = new ConnectorClass({ env: {} })
      expect(connector.tools.length).toBeGreaterThan(0)

      connector.tools.forEach((tool) => {
        expect(tool.name).toBeDefined()
        expect(tool.riskLevel).toBeDefined()
        expect(tool.description).toBeDefined()
      })
    })
  })
})
