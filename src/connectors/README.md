# Connectors — Faza 10 Refactor

Unified connector architecture for all external services. Each connector implements:
- **Manifest**: versioning, scopes, risk levels, redaction rules
- **Tools**: typed definitions with parameters and risk classification
- **Execution**: with audit logging and error handling
- **Redaction**: automatic sensitive data masking

## Architecture

```typescript
BaseConnector
├── manifest: ConnectorManifest (versioning, scopes, risk profile)
├── tools: ToolDefinition[] (all operations)
└── execute(toolName, args): ConnectorExecutionResult
    ├── logAuditEvent()
    ├── redactOutput()
    └── result with [REDACTED] on sensitive fields
```

## Connectors

| Connector | Provider | Default Risk | Critical Ops | Scopes |
|-----------|----------|--------------|--------------|--------|
| **GitHub** | GitHub | low | github_push_file | repo:read, repo:write |
| **Vercel** | Vercel | low | vercel_rollback | projects:read, deployments:* |
| **Email** | IMAP/SMTP | medium | email_send_bulk | email:read, email:send |
| **Stripe** | Stripe | high | stripe_refund | read:charges, write:refunds |
| **Clerk** | Clerk | medium | clerk_ban_user | users:read, users:manage |
| **Polutek** | Custom | high | polutek_process_refund | patrons:*, payments:* |

## Redaction Rules

Each connector redacts:
1. **Global fields**: token, password, apiKey, authorization
2. **Patterns**: secrets (sk_*, pk_*, tokens)
3. **Tool-specific**: email addresses, charge IDs, customer data

Example:
```typescript
const result = connector.redactOutput({
  token: 'sk_test_123',      // → '[REDACTED]'
  email: 'user@example.com', // → '[REDACTED]'
  count: 42                   // → 42
})
```

## Audit Events

Every execution is logged:
```typescript
{
  type: 'connector_audit',
  connector: 'github',
  timestamp: '2026-07-11T...',
  toolName: 'github_push_file',
  status: 'success',
  duration: 234,
  resultPreview: '{"sha":"abc123"}'
}
```

Retention: 90–365 days per connector config.

## Idempotency

Refund and payment operations have idempotency enabled:
- Key extractor: `stripe-${chargeId}-refund`
- Prevents duplicate charges on retry

## Usage

```typescript
import { createConnector } from './registry'

const ctx = { env: process.env, chatId: 123 }
const github = createConnector('github', ctx)

const result = await github.execute('github_push_file', {
  repo: 'pawelekbyra/BolekAI',
  path: 'src/index.ts',
  content: '...',
  message: 'Update index'
})

// result.data is already redacted
console.log(result.data)
```

## Adding a Connector

1. Extend `BaseConnector`
2. Define `manifest` and `tools`
3. Implement `execute(toolName, args)`
4. Register in `registry.ts`
5. Add tests in `connectors.test.ts`

## Testing

```bash
npm test src/connectors/
```

All connectors are tested for:
- Manifest validity
- Tool exposure
- Risk classification
- Redaction patterns
- Audit events
