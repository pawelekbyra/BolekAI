import type { Env } from '../env'

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Bolek is owner-only by default (see CLAUDE.md). Every /api/* route exposes
 * agent state, tool execution, or operational data and must require this key -
 * there is no "public" tier.
 */
export function isOwnerRequest(request: Request, env: Env): boolean {
  const expected = env.BOLEK_API_KEY
  if (!expected) return false

  const header = request.headers.get('Authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) return false

  return timingSafeStringEqual(match[1], expected)
}
