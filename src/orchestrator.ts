import type { Env } from './env'
import { getHistory, saveMessage } from './memory'
import { tools, executeTool } from './tools'
import { buildPolutekConfigStatus } from './tools/polutek'
import { getAllFacts } from './tools/facts'
import { recallRelevant } from './tools/memory'

const BASE_SYSTEM_PROMPT = `Jesteś AGENT BOLEK — osobisty asystent AI swojego właściciela.
Rozmawiasz wyłącznie po polsku. Jesteś konkretny, bezpośredni i pomocny.
Masz dostęp do narzędzi: zadania, notatki, przypomnienia, pamięć o właścicielu oraz przeglądanie internetu.
Gdy użytkownik chce coś zapamiętać, zapisać, przypomnieć lub sprawdzić — użyj narzędzia.
Gdy pytanie dotyczy aktualnych informacji, newsów, cen, dokumentacji, ofert lub faktów które mogły się zmienić — użyj web_search, web_fetch albo web_research i oprzyj odpowiedź na wynikach.
Do prostego sprawdzenia użyj web_search/web_fetch. Do porównania kilku źródeł, rekomendacji zakupowej/technicznej albo decyzji wymagającej większej pewności użyj web_research.
Po każdym researchu internetowym cytuj źródła w finalnej odpowiedzi w formacie:
Według źródeł:
- domena — krótki wniosek (URL)
- domena — krótki wniosek (URL)
Moja rekomendacja: ...
Pewność: niska/średnia/wysoka — krótko dlaczego.
Nigdy nie zmyślaj informacji które powinny być w bazie albo w internecie — zawsze użyj narzędzia.
Gdy dowiadujesz się czegoś ważnego o właścicielu — zapisz to przez fact_save.
Gdy pojawia się szerszy kontekst, decyzja albo wydarzenie warte przypomnienia po znaczeniu — zapisz przez memory_remember. Fakty (imię, alergia) idą do fact_save; pamięci narracyjne do memory_remember.`

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: Array<{ id: string; name: string; arguments: unknown }>
  tool_call_id?: string
}

type AIResponse = {
  response?: string
  tool_calls?: Array<{ id: string; name: string; arguments: unknown }>
}

// ─── Claude API ───────────────────────────────────────────────────────────────

type ClaudeContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string }

type ClaudeMessage = {
  role: 'user' | 'assistant'
  content: string | ClaudeContent[]
}

async function runClaude(env: Env, messages: ChatMessage[], withTools = true): Promise<AIResponse> {
  const systemMsg = messages.find((m) => m.role === 'system')?.content ?? BASE_SYSTEM_PROMPT
  const chatMsgs: ClaudeMessage[] = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user' as const,
          content: [{ type: 'tool_result' as const, tool_use_id: m.tool_call_id ?? '', content: m.content }],
        }
      }
      if (m.tool_calls?.length) {
        return {
          role: 'assistant' as const,
          content: m.tool_calls.map((tc) => ({
            type: 'tool_use' as const,
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          })),
        }
      }
      return { role: m.role as 'user' | 'assistant', content: m.content }
    })

  const body: Record<string, unknown> = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemMsg,
    messages: chatMsgs,
  }

  if (withTools) {
    body.tools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }))
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json() as {
    content: ClaudeContent[]
    stop_reason: string
  }

  const toolUse = data.content.find((c) => c.type === 'tool_use') as Extract<ClaudeContent, { type: 'tool_use' }> | undefined
  if (toolUse) {
    return {
      tool_calls: [{ id: toolUse.id, name: toolUse.name, arguments: toolUse.input }],
    }
  }

  const text = (data.content.find((c) => c.type === 'text') as Extract<ClaudeContent, { type: 'text' }> | undefined)?.text
  return { response: text ?? 'Gotowe.' }
}

// ─── Workers AI ───────────────────────────────────────────────────────────────

async function runWorkersAI(env: Env, messages: ChatMessage[], withTools = true): Promise<AIResponse> {
  const ai = env.AI as Ai
  const params: Record<string, unknown> = { messages }
  if (withTools) {
    params.tools = tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }))
  }
  return (await (ai.run as Function)(env.AI_MODEL, params)) as AIResponse
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

function runAI(env: Env, messages: ChatMessage[], withTools = true): Promise<AIResponse> {
  return env.ANTHROPIC_API_KEY ? runClaude(env, messages, withTools) : runWorkersAI(env, messages, withTools)
}


type WebResearchSource = {
  title?: string
  url?: string
  snippet?: string
  excerpt?: string
  error?: string
}

type WebResearchResult = {
  query?: string
  confidence?: string
  sources?: WebResearchSource[]
  comparison?: string[]
  source_count?: number
}

function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function compactEvidence(source: WebResearchSource): string {
  const text = (source.excerpt || source.snippet || source.error || 'brak streszczenia')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 240 ? `${text.slice(0, 240)}…` : text
}

function formatResearchAnswer(result: WebResearchResult): string {
  const sources = result.sources?.filter((source) => source.url) ?? []
  const usable = sources.filter((source) => !source.error)
  const confidence = result.confidence === 'high' ? 'wysoka' : result.confidence === 'medium' ? 'średnia' : 'niska'

  return [
    `Według źródeł:`,
    ...sources.map((source) => `- ${sourceDomain(source.url!)} — ${compactEvidence(source)} (${source.url})`),
    '',
    `Moja rekomendacja: oprzyj decyzję na ${usable.length} poprawnie pobranych źródłach i traktuj powyższe cytaty jako punkt startowy do finalnej decyzji.`,
    `Pewność: ${confidence} — poprawnie pobrano ${usable.length}/${sources.length} źródeł.`,
  ].join('\n')
}

async function handleOperatorCommand(userText: string, chatId: number, env: Env): Promise<string | null> {
  const text = userText.trim()
  if (!text.startsWith('/')) return null

  const [command, ...rest] = text.split(/\s+/)
  const arg = rest.join(' ').trim()

  switch (command.toLowerCase()) {
    case '/research': {
      if (!arg) return 'Użycie: /research temat do sprawdzenia'
      const result = await executeTool('web_research', { query: arg, limit: 5 }, env.DB, chatId, env) as WebResearchResult
      return formatResearchAnswer(result)
    }
    case '/status': {
      const polutek = buildPolutekConfigStatus(env)
      return [
        'Status Bolka:',
        `- model: ${env.ANTHROPIC_API_KEY ? 'Claude' : env.AI_MODEL}`,
        `- Polutek config: ${polutek.ready ? '✅ gotowy' : '⚠️ wymaga konfiguracji'}`,
        `- KV cache: ${env.KV ? '✅ dostępny' : '❌ brak'}`,
      ].join('\n')
    }
    case '/help':
      return [
        'Komendy operatorskie:',
        '- /research temat — głęboki research z linkami i pewnością',
        '- /status — szybki status Bolka i konfiguracji',
        '- /help — ta lista',
      ].join('\n')
    default:
      return null
  }
}

// ─── Core ─────────────────────────────────────────────────────────────────────

async function buildMessages(userText: string, chatId: number, env: Env): Promise<ChatMessage[]> {
  const [history, facts, memories] = await Promise.all([
    getHistory(env.DB, chatId, 10),
    getAllFacts(env.DB),
    recallRelevant(env, userText),
  ])
  return [
    { role: 'system', content: BASE_SYSTEM_PROMPT + facts + memories },
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userText },
  ]
}

async function resolveToolCalls(first: AIResponse, messages: ChatMessage[], chatId: number, env: Env): Promise<string> {
  if (!first.tool_calls?.length) return first.response ?? 'Nie rozumiem, spróbuj inaczej.'

  const call = first.tool_calls[0]
  const result = await executeTool(call.name, call.arguments, env.DB, chatId, env)

  const second = await runAI(env, [
    ...messages,
    { role: 'assistant', content: '', tool_calls: first.tool_calls },
    { role: 'tool', content: JSON.stringify(result), tool_call_id: call.id },
  ], false)

  return second.response ?? 'Gotowe.'
}

export async function orchestrate(userText: string, chatId: number, env: Env): Promise<string> {
  await saveMessage(env.DB, chatId, 'user', userText)
  const commandReply = await handleOperatorCommand(userText, chatId, env)
  if (commandReply) {
    await saveMessage(env.DB, chatId, 'assistant', commandReply)
    return commandReply
  }

  const messages = await buildMessages(userText, chatId, env)
  const first = await runAI(env, messages)
  const reply = await resolveToolCalls(first, messages, chatId, env)
  await saveMessage(env.DB, chatId, 'assistant', reply)
  return reply
}

export async function orchestrateStream(userText: string, chatId: number, env: Env): Promise<{ stream: ReadableStream }> {
  await saveMessage(env.DB, chatId, 'user', userText)
  const commandReply = await handleOperatorCommand(userText, chatId, env)
  const reply = commandReply ?? await (async () => {
    const messages = await buildMessages(userText, chatId, env)
    const first = await runAI(env, messages)
    return resolveToolCalls(first, messages, chatId, env)
  })()
  await saveMessage(env.DB, chatId, 'assistant', reply)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      for (const word of reply.split(' ')) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: word + ' ' })}\n\n`))
        await new Promise((r) => setTimeout(r, 30))
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return { stream }
}
