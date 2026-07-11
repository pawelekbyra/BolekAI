import type { RiskLevel } from '../security/types'
import type { PolicyDecision } from '../security/policy'

/**
 * Global fields that are always redacted from tool outputs.
 * Sensitive fields present in any tool output will be masked.
 */
export const GLOBAL_REDACTION_FIELDS = [
  'token',
  'secret',
  'password',
  'authorization',
  'auth_token',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'cookie',
  'session',
  'videoUrl',
  'video_url',
]

/**
 * Tool-specific redaction rules.
 * Maps tool names to patterns to redact from their outputs.
 */
export type RedactionRules = {
  fields?: string[] // Additional fields to redact beyond global ones
  patterns?: RegExp[] // Regex patterns to redact (e.g., email addresses, phone numbers)
  customRedact?: (output: unknown) => unknown // Custom redaction function
}

/**
 * Idempotency configuration for a tool.
 * Ensures the same approval doesn't execute side-effects twice.
 */
export type ToolDefaultPolicy = PolicyDecision['type']

export type IdempotencyConfig = {
  enabled: boolean
  keyField?: string // Field in args that serves as idempotency key (e.g., "approval_id")
  ttl?: number // Time-to-live in seconds for idempotency keys (default: 86400 = 24h)
}

/**
 * Formal tool metadata with versioning, scopes, and redaction rules.
 * Every tool must be registered as a manifest.
 */
export type ToolManifest = {
  // Identity
  id: string // Unique identifier (e.g., "stripe_refund_v1")
  name: string // Tool name (matches orchestrator dispatch)
  version: string // Semantic versioning (e.g., "1.0.0")
  provider: string // Where the tool comes from (e.g., "stripe", "github", "internal", "external-service")

  // Description
  description: string

  // Schemas
  inputSchema: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required?: string[]
  }
  outputSchema?: {
    type: string
    properties?: Record<string, unknown>
  }

  // Security & Policy
  riskLevel: RiskLevel
  sideEffect: boolean
  requiredScopes: string[] // OAuth scopes, permissions, or resource scopes (e.g., "user:repo", "stripe:write_refund")
  defaultPolicy: ToolDefaultPolicy // Baseline policy before runtime context/env overrides

  // Redaction & Compliance
  redactionRules: RedactionRules

  // Execution guarantees
  idempotency: IdempotencyConfig
}

/**
 * Redacts sensitive fields from tool output.
 * Applies global + tool-specific rules.
 */
function redactStringValue(manifest: ToolManifest, value: string): string {
  let redacted = value

  for (const pattern of manifest.redactionRules.patterns ?? []) {
    redacted = redacted.replace(pattern, '[REDACTED]')
  }

  return redacted
}

function redactValue(manifest: ToolManifest, value: unknown, fieldsToRedact: Set<string>): unknown {
  if (value === null || value === undefined) return value

  if (typeof value === 'string') {
    return redactStringValue(manifest, value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(manifest, item, fieldsToRedact))
  }

  if (typeof value === 'object') {
    const redacted: Record<string, unknown> = {}

    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      redacted[key] = fieldsToRedact.has(key)
        ? '[REDACTED]'
        : redactValue(manifest, nestedValue, fieldsToRedact)
    }

    return redacted
  }

  return value
}

export function redactToolOutput(manifest: ToolManifest, output: unknown): unknown {
  const fieldsToRedact = new Set([
    ...GLOBAL_REDACTION_FIELDS,
    ...(manifest.redactionRules.fields ?? []),
  ])

  const redacted = redactValue(manifest, output, fieldsToRedact)

  if (manifest.redactionRules.customRedact) {
    return manifest.redactionRules.customRedact(redacted)
  }

  return redacted
}

/**
 * Validates tool arguments against the manifest's input schema.
 * Returns validation result with error message if validation fails.
 */
export function validateToolArgs(manifest: ToolManifest, args: unknown): { valid: boolean; error?: string } {
  if (typeof args !== 'object' || args === null) {
    return { valid: false, error: `Arguments must be an object, got ${typeof args}` }
  }

  const obj = args as Record<string, unknown>
  const schema = manifest.inputSchema
  const required = schema.required ?? []

  // Check required fields
  for (const field of required) {
    if (!(field in obj)) {
      return { valid: false, error: `Missing required argument: "${field}"` }
    }
  }

  // Check field types (basic validation)
  for (const field in obj) {
    if (field in schema.properties) {
      const fieldSchema = schema.properties[field]
      const value = obj[field]
      const expectedType = fieldSchema.type

      // Simple type check
      if (expectedType === 'string' && typeof value !== 'string') {
        return { valid: false, error: `Argument "${field}" must be a string, got ${typeof value}` }
      }
      if (expectedType === 'number' && typeof value !== 'number') {
        return { valid: false, error: `Argument "${field}" must be a number, got ${typeof value}` }
      }
      if (expectedType === 'boolean' && typeof value !== 'boolean') {
        return { valid: false, error: `Argument "${field}" must be a boolean, got ${typeof value}` }
      }
    }
  }

  return { valid: true }
}

/**
 * Normalizes (cleans/transforms) tool arguments.
 * Trims strings, parses numbers, etc.
 */
export function normalizeToolArgs(manifest: ToolManifest, args: unknown): unknown {
  if (typeof args !== 'object' || args === null) return args

  const obj = args as Record<string, unknown>
  const normalized: Record<string, unknown> = {}

  for (const field in obj) {
    const value = obj[field]
    const schema = manifest.inputSchema.properties[field]

    if (!schema) {
      // Keep unknown fields as-is
      normalized[field] = value
      continue
    }

    // Trim strings
    if (schema.type === 'string' && typeof value === 'string') {
      normalized[field] = value.trim()
      continue
    }

    // Parse numbers
    if (schema.type === 'number' && typeof value === 'string') {
      normalized[field] = parseFloat(value)
      continue
    }

    normalized[field] = value
  }

  return normalized
}
