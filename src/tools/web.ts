import type { Env } from '../env'
import type { ToolDefinition } from './index'

const MAX_RESPONSE_CHARS = 12000
const DEFAULT_TIMEOUT_MS = 10000
const DEFAULT_CACHE_TTL_SECONDS = 60 * 30
const RESEARCH_SOURCE_LIMIT = 5
const RESEARCH_EXCERPT_CHARS = 1800
const WEB_CACHE_PREFIX = 'web:'

export const webTools: ToolDefinition[] = [
  {
    name: 'web_search',
    riskLevel: 'low',
    sideEffect: false,
    description: 'Wyszukaj aktualne informacje w internecie. Zwraca tytuł, URL i snippet. W odpowiedzi końcowej zawsze cytuj użyte linki.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Fraza do wyszukania w internecie' },
        limit: { type: 'number', description: 'Maksymalna liczba wyników, domyślnie 5' },
        cache_ttl_seconds: { type: 'number', description: 'Opcjonalny czas cache w KV w sekundach, domyślnie 1800' },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_fetch',
    riskLevel: 'low',
    sideEffect: false,
    description: 'Pobierz i streść zawartość konkretnej strony WWW pod podanym adresem URL. W odpowiedzi końcowej cytuj URL strony.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Pełny adres strony, np. https://example.com/artykul' },
        cache_ttl_seconds: { type: 'number', description: 'Opcjonalny czas cache w KV w sekundach, domyślnie 1800' },
      },
      required: ['url'],
    },
  },
  {
    name: 'web_research',
    riskLevel: 'low',
    sideEffect: false,
    description: 'Tryb głębokiego researchu: wyszukuje temat, wybiera 3–5 źródeł, pobiera je, porównuje i zwraca wnioski, linki oraz ocenę pewności. Używaj do pytań wymagających porównania kilku źródeł.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Temat lub pytanie badawcze' },
        limit: { type: 'number', description: 'Liczba źródeł do sprawdzenia, domyślnie 5' },
        cache_ttl_seconds: { type: 'number', description: 'Opcjonalny czas cache w KV w sekundach, domyślnie 1800' },
      },
      required: ['query'],
    },
  },
]

type Args = { query?: string; limit?: number; url?: string; cache_ttl_seconds?: number }
type SearchResult = { title: string; url: string; snippet: string }
type FetchResult = { url: string; status: number; content_type: string; text: string; cached?: boolean }
type ResearchSource = SearchResult & { status?: number; content_type?: string; excerpt?: string; error?: string }
type ResearchResult = {
  query: string
  source_count: number
  confidence: 'low' | 'medium' | 'high'
  sources: ResearchSource[]
  comparison: string[]
  recommendation: string
  cached?: boolean
}

function timeoutSignal(ms = DEFAULT_TIMEOUT_MS): AbortSignal {
  const controller = new AbortController()
  setTimeout(() => controller.abort('Timeout'), ms)
  return controller.signal
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function stripHtml(value: string): string {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
}

function normalizeUrl(value: string): string {
  const parsed = new URL(value)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Obsługiwane są tylko adresy http:// i https://')
  }
  return parsed.toString()
}

function safeLimit(limit: number | undefined, fallback: number, max: number): number {
  return Math.min(Math.max(Math.floor(limit ?? fallback), 1), max)
}

function cacheTtl(argsTtl?: number): number {
  return Math.min(Math.max(Math.floor(argsTtl ?? DEFAULT_CACHE_TTL_SECONDS), 60), 60 * 60)
}

async function cacheKey(parts: unknown[]): Promise<string> {
  const input = JSON.stringify(parts)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${WEB_CACHE_PREFIX}${hex}`
}

async function withCache<T>(env: Env | undefined, keyParts: unknown[], ttlSeconds: number, load: () => Promise<T>): Promise<T & { cached?: boolean }> {
  if (!env?.KV) return load() as Promise<T & { cached?: boolean }>

  const key = await cacheKey(keyParts)
  const cached = await env.KV.get(key, 'json') as T | null
  if (cached) return { ...cached, cached: true }

  const fresh = await load()
  await env.KV.put(key, JSON.stringify(fresh), { expirationTtl: ttlSeconds })
  return fresh as T & { cached?: boolean }
}

function extractDuckDuckGoResults(html: string, limit: number): SearchResult[] {
  const results: SearchResult[] = []
  const resultRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = resultRegex.exec(html)) && results.length < limit) {
    let url = decodeHtml(match[1])
    if (url.startsWith('//duckduckgo.com/l/?')) {
      const redirected = new URL(`https:${url}`).searchParams.get('uddg')
      if (redirected) url = redirected
    }

    results.push({ title: stripHtml(match[2]), url, snippet: stripHtml(match[3]) })
  }

  return results
}

function extractPageText(html: string): string {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)?.[1]
  const body = stripHtml(html)
  return [title ? `Tytuł: ${stripHtml(title)}` : '', description ? `Opis: ${decodeHtml(description)}` : '', body]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, MAX_RESPONSE_CHARS)
}

async function uncachedWebSearch(query: string, limit = 5): Promise<{ query: string; results: SearchResult[] }> {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Agent-Bolek/1.0 (+https://kulfon.pawel-perfect.workers.dev)' }, signal: timeoutSignal() })
  if (!res.ok) throw new Error(`Wyszukiwarka zwróciła HTTP ${res.status}`)
  const html = await res.text()
  return { query, results: extractDuckDuckGoResults(html, safeLimit(limit, 5, 10)) }
}

function webSearch(query: string, limit = 5, env?: Env, ttlSeconds = DEFAULT_CACHE_TTL_SECONDS): Promise<{ query: string; results: SearchResult[]; cached?: boolean }> {
  const normalizedLimit = safeLimit(limit, 5, 10)
  return withCache(env, ['search', query, normalizedLimit], ttlSeconds, () => uncachedWebSearch(query, normalizedLimit))
}

async function uncachedWebFetch(url: string): Promise<FetchResult> {
  const normalized = normalizeUrl(url)
  const res = await fetch(normalized, { headers: { 'User-Agent': 'Agent-Bolek/1.0 (+https://kulfon.pawel-perfect.workers.dev)' }, signal: timeoutSignal() })
  const contentType = res.headers.get('content-type') ?? ''
  const raw = await res.text()
  const text = contentType.includes('text/html') ? extractPageText(raw) : raw.slice(0, MAX_RESPONSE_CHARS)
  return { url: normalized, status: res.status, content_type: contentType, text }
}

function webFetch(url: string, env?: Env, ttlSeconds = DEFAULT_CACHE_TTL_SECONDS): Promise<FetchResult> {
  const normalized = normalizeUrl(url)
  return withCache(env, ['fetch', normalized], ttlSeconds, () => uncachedWebFetch(normalized))
}

function summarizeSource(source: ResearchSource): string {
  if (source.error) return `${source.title} — nie udało się pobrać (${source.error}).`
  const excerpt = source.excerpt || source.snippet
  return `${source.title} — ${excerpt.slice(0, 260)}${excerpt.length > 260 ? '…' : ''}`
}

async function webResearch(query: string, limit = RESEARCH_SOURCE_LIMIT, env?: Env, ttlSeconds = DEFAULT_CACHE_TTL_SECONDS): Promise<ResearchResult> {
  const sourceLimit = safeLimit(limit, RESEARCH_SOURCE_LIMIT, RESEARCH_SOURCE_LIMIT)
  return withCache(env, ['research', query, sourceLimit], ttlSeconds, async () => {
    const search = await uncachedWebSearch(query, sourceLimit)
    const fetched = await Promise.all(search.results.slice(0, sourceLimit).map(async (result): Promise<ResearchSource> => {
      try {
        const page = await uncachedWebFetch(result.url)
        return { ...result, status: page.status, content_type: page.content_type, excerpt: page.text.slice(0, RESEARCH_EXCERPT_CHARS) }
      } catch (error) {
        return { ...result, error: error instanceof Error ? error.message : 'Nieznany błąd' }
      }
    }))
    const successful = fetched.filter((source) => !source.error && source.excerpt)
    const confidence = successful.length >= 4 ? 'high' : successful.length >= 2 ? 'medium' : 'low'

    return {
      query,
      source_count: successful.length,
      confidence,
      sources: fetched,
      comparison: fetched.map(summarizeSource),
      recommendation: 'Porównaj treści z pól sources/excerpt i w odpowiedzi końcowej pokaż sekcję „Według źródeł” z linkami, potem „Moja rekomendacja” oraz ocenę pewności.',
    }
  })
}

export async function executeWebTool(name: string, args: unknown, env?: Env): Promise<unknown> {
  const a = args as Args
  const ttl = cacheTtl(a.cache_ttl_seconds)

  switch (name) {
    case 'web_search':
      if (!a.query) throw new Error('Brak query')
      return webSearch(a.query, a.limit, env, ttl)
    case 'web_fetch':
      if (!a.url) throw new Error('Brak url')
      return webFetch(a.url, env, ttl)
    case 'web_research':
      if (!a.query) throw new Error('Brak query')
      return webResearch(a.query, a.limit, env, ttl)
    default:
      throw new Error(`Unknown web tool: ${name}`)
  }
}
