import type { Env } from './env'
import { getHistory, saveMessage } from './memory'
import { tools, executeTool } from './tools'
import { getAllFacts } from './tools/facts'

const BASE_SYSTEM_PROMPT = `Jesteś AGENT BOLEK — osobisty asystent AI swojego właściciela.
Rozmawiasz wyłącznie po polsku. Jesteś konkretny, bezpośredni i pomocny.
Masz dostęp do narzędzi: zadania, notatki, przypomnienia, pamięć o właścicielu oraz przeglądanie internetu.
Gdy użytkownik chce coś zapamiętać, zapisać, przypomnieć lub sprawdzić — użyj narzędzia.
Gdy pytanie dotyczy aktualnych informacji, newsów, cen, dokumentacji, ofert lub faktów które mogły się zmienić — użyj web_search albo web_fetch i oprzyj odpowiedź na wynikach.
Nigdy nie zmyślaj informacji które powinny być w bazie albo w internecie — zawsze użyj narzędzia.
Gdy dowiadujesz się czegoś ważnego o właścicielu — zapisz to przez fact_save.`

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

// ─── Core ─────────────────────────────────────────────────────────────────────

async function buildMessages(userText: string, chatId: number, env: Env): Promise<ChatMessage[]> {
  const [history, facts] = await Promise.all([getHistory(env.DB, chatId, 10), getAllFacts(env.DB)])
  return [
    { role: 'system', content: BASE_SYSTEM_PROMPT + facts },
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
  const messages = await buildMessages(userText, chatId, env)
  const first = await runAI(env, messages)
  const reply = await resolveToolCalls(first, messages, chatId, env)
  await saveMessage(env.DB, chatId, 'assistant', reply)
  return reply
}

export async function orchestrateStream(userText: string, chatId: number, env: Env): Promise<{ stream: ReadableStream }> {
  await saveMessage(env.DB, chatId, 'user', userText)
  const messages = await buildMessages(userText, chatId, env)
  const first = await runAI(env, messages)
  const reply = await resolveToolCalls(first, messages, chatId, env)
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
