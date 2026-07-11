export const BOLEK_API = process.env.NEXT_PUBLIC_BOLEK_API_URL ?? 'http://localhost:8787'

const OWNER_KEY = process.env.NEXT_PUBLIC_BOLEK_API_KEY

/**
 * Attaches the owner key required by the Worker's /api/* guard (src/security/owner-guard.ts).
 * NOTE: this is a NEXT_PUBLIC_ value, so it ships inside the browser bundle - it stops
 * anonymous internet traffic from hitting the Worker directly, but it does not make this
 * dashboard itself private. Put the dashboard behind Vercel deployment protection or
 * Cloudflare Access if it must not be viewable by anyone who finds the URL.
 */
export function bolekFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  if (OWNER_KEY) headers.set('Authorization', `Bearer ${OWNER_KEY}`)
  return fetch(`${BOLEK_API}${path}`, { ...init, headers })
}
