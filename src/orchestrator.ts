import Anthropic from '@anthropic-ai/sdk'
import type { Env } from './env'
import { getHistory, saveMessage } from './memory'
import { tools, executeTool } from './tools'
import { buildPolutekConfigStatus } from './tools/polutek'
import { getAllFacts } from './tools/facts'

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
Możesz wywoływać kilka narzędzi pod rząd, jedno po drugim, zanim odpowiesz użytkownikowi — rób to, gdy zadanie tego wymaga.`

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOOL_ITERATIONS = 8

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// ─── Workers AI fallback (used only when ANTHROPIC_API_KEY is not set) ────────

type WorkersAIResponse = {
  response?: string
  tool_calls?: Array<{ id?: string; name: string; arguments: unknown }>
}

async function runWorkersAI(env: Env, messages: ChatMessage[]): Promise<string> {
  const ai = env.AI as Ai
  const params: Record<string, unknown> = {
    messages,
    tools: tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
  }
  const first = (await (ai.run as Function)(env.AI_MODEL, params)) as WorkersAIResponse
  if (!first.tool_calls?.length) return first.response ?? 'Nie rozumiem, spróbuj inaczej.'

  // Workers AI binding only supports a single round of tool calls — no multi-step loop.
  const call = first.tool_calls[0]
  const result = await executeTool(call.name, call.arguments, env.DB, 0, env)
  const second = (await (ai.run as Function)(env.AI_MODEL, {
    messages: [...messages, { role: 'assistant', content: JSON.stringify(result) }],
  })) as WorkersAIResponse
  return second.response ?? 'Gotowe.'
}

// ─── Web research formatting ────────────────────────────────────────────────────

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
  const [history, facts] = await Promise.all([getHistory(env.DB, chatId, 10), getAllFacts(env.DB)])
  return [
    { role: 'system', content: BASE_SYSTEM_PROMPT + facts },
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userText },
  ]
}

function toClaudeParams(messages: ChatMessage[]): { system: string; messages: Anthropic.MessageParam[] } {
  const system = messages.find((m) => m.role === 'system')?.content ?? BASE_SYSTEM_PROMPT
  const claudeMessages: Anthropic.MessageParam[] = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  return { system, messages: claudeMessages }
}

const claudeTools: Anthropic.Tool[] = tools.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.parameters as Anthropic.Tool.InputSchema,
}))

/**
 * Runs one turn of the conversation against Claude. If `onTextDelta` is given,
 * the turn is streamed and each text chunk is forwarded live; otherwise it's a
 * single non-streaming request. Returns the completed assistant message.
 */
async function runClaudeTurn(
  client: Anthropic,
  system: string,
  messages: Anthropic.MessageParam[],
  onTextDelta?: (delta: string) => void
): Promise<Anthropic.Message> {
  if (!onTextDelta) {
    return client.messages.create({ model: CLAUDE_MODEL, max_tokens: 4096, system, messages, tools: claudeTools })
  }

  const stream = client.messages.stream({ model: CLAUDE_MODEL, max_tokens: 4096, system, messages, tools: claudeTools })
  stream.on('text', onTextDelta)
  return stream.finalMessage()
}

/**
 * Runs the full agentic tool-use loop against the Claude API: executes every
 * tool_use block Claude requests, feeds results back, and repeats until
 * Claude stops calling tools or MAX_TOOL_ITERATIONS is hit. When `onTextDelta`
 * is provided, every turn (including intermediate ones before tool calls) is
 * streamed to it live.
 */
async function runClaudeLoop(
  env: Env,
  chatId: number,
  initial: ChatMessage[],
  onTextDelta?: (delta: string) => void
): Promise<string> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  const { system, messages } = toClaudeParams(initial)

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await runClaudeTurn(client, system, messages, onTextDelta)

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    )

    if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
      const text = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text
      return text ?? 'Gotowe.'
    }

    messages.push({ role: 'assistant', content: response.content })

    // Execute every requested tool call — Claude may ask for several in one turn.
    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (call) => {
        try {
          const result = await executeTool(call.name, call.input, env.DB, chatId, env)
          return { type: 'tool_result' as const, tool_use_id: call.id, content: JSON.stringify(result) }
        } catch (err) {
          return {
            type: 'tool_result' as const,
            tool_use_id: call.id,
            content: err instanceof Error ? err.message : String(err),
            is_error: true,
          }
        }
      })
    )

    messages.push({ role: 'user', content: toolResults })
  }

  return 'Zbyt wiele kroków narzędziowych pod rząd — przerwałem, żeby nie zapętlić się. Spróbuj podzielić zadanie na mniejsze kroki.'
}

export async function orchestrate(userText: string, chatId: number, env: Env): Promise<string> {
  await saveMessage(env.DB, chatId, 'user', userText)
  const commandReply = await handleOperatorCommand(userText, chatId, env)
  if (commandReply) {
    await saveMessage(env.DB, chatId, 'assistant', commandReply)
    return commandReply
  }

  const messages = await buildMessages(userText, chatId, env)
  const reply = env.ANTHROPIC_API_KEY
    ? await runClaudeLoop(env, chatId, messages)
    : await runWorkersAI(env, messages)

  await saveMessage(env.DB, chatId, 'assistant', reply)
  return reply
}

export async function orchestrateStream(userText: string, chatId: number, env: Env): Promise<{ stream: ReadableStream }> {
  await saveMessage(env.DB, chatId, 'user', userText)
  const commandReply = await handleOperatorCommand(userText, chatId, env)
  const encoder = new TextEncoder()

  if (commandReply) {
    await saveMessage(env.DB, chatId, 'assistant', commandReply)
    return {
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: commandReply })}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      }),
    }
  }

  const messages = await buildMessages(userText, chatId, env)

  if (!env.ANTHROPIC_API_KEY) {
    // Workers AI has no streaming path here — resolve fully, then flush as one chunk.
    const reply = await runWorkersAI(env, messages)
    await saveMessage(env.DB, chatId, 'assistant', reply)
    return {
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: reply })}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      }),
    }
  }

  // Real token-by-token streaming: every turn of the tool loop (including
  // intermediate "let me check that" turns before a tool call) streams live.
  const stream = new ReadableStream({
    async start(controller) {
      let fullText = ''
      const onTextDelta = (delta: string) => {
        fullText += delta
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`))
      }
      try {
        const reply = await runClaudeLoop(env, chatId, messages, onTextDelta)
        // If the loop's return value differs from what streamed (e.g. the
        // iteration-limit fallback message), flush the difference so the
        // client still receives the full final text.
        if (reply !== fullText) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: reply })}\n\n`))
        }
        await saveMessage(env.DB, chatId, 'assistant', reply)
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  return { stream }
}
