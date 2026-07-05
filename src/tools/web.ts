import type { ToolDefinition } from './index'

const MAX_RESPONSE_CHARS = 12000
const DEFAULT_TIMEOUT_MS = 10000

export const webTools: ToolDefinition[] = [
  {
    name: 'web_search',
    description: 'Wyszukaj aktualne informacje w internecie. Używaj gdy pytanie dotyczy bieżących danych, newsów, cen, dokumentacji, ofert lub gdy trzeba zweryfikować fakt online.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Fraza do wyszukania w internecie' },
        limit: { type: 'number', description: 'Maksymalna liczba wyników, domyślnie 5' },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_fetch',
    description: 'Pobierz i streść zawartość konkretnej strony WWW pod podanym adresem URL.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Pełny adres strony, np. https://example.com/artykul' },
      },
      required: ['url'],
    },
  },
]

type Args = { query?: string; limit?: number; url?: string }
type SearchResult = { title: string; url: string; snippet: string }

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

    results.push({
      title: stripHtml(match[2]),
      url,
      snippet: stripHtml(match[3]),
    })
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

async function webSearch(query: string, limit = 5): Promise<{ query: string; results: SearchResult[] }> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 10)
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Agent-Bolek/1.0 (+https://kulfon.pawel-perfect.workers.dev)' },
    signal: timeoutSignal(),
  })

  if (!res.ok) throw new Error(`Wyszukiwarka zwróciła HTTP ${res.status}`)

  const html = await res.text()
  return { query, results: extractDuckDuckGoResults(html, safeLimit) }
}

async function webFetch(url: string): Promise<{ url: string; status: number; content_type: string; text: string }> {
  const normalized = normalizeUrl(url)
  const res = await fetch(normalized, {
    headers: { 'User-Agent': 'Agent-Bolek/1.0 (+https://kulfon.pawel-perfect.workers.dev)' },
    signal: timeoutSignal(),
  })
  const contentType = res.headers.get('content-type') ?? ''
  const raw = await res.text()
  const text = contentType.includes('text/html') ? extractPageText(raw) : raw.slice(0, MAX_RESPONSE_CHARS)

  return { url: normalized, status: res.status, content_type: contentType, text }
}

export async function executeWebTool(name: string, args: unknown): Promise<unknown> {
  const a = args as Args

  switch (name) {
    case 'web_search':
      if (!a.query) throw new Error('Brak query')
      return webSearch(a.query, a.limit)
    case 'web_fetch':
      if (!a.url) throw new Error('Brak url')
      return webFetch(a.url)
    default:
      throw new Error(`Unknown web tool: ${name}`)
  }
}
