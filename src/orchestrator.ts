import type { Env } from './env'
import { getHistory, saveMessage } from './memory'
import { tools, executeTool } from './tools'
import { getAllFacts } from './tools/facts'

const BASE_SYSTEM_PROMPT = `Jesteś AGENT BOLEK — osobisty asystent AI swojego właściciela.
Rozmawiasz wyłącznie po polsku. Jesteś konkretny, bezpośredni i pomocny.
Masz dostęp do narzędzi: zadania, notatki, przypomnienia, pamięć o właścicielu.
Gdy użytkownik chce coś zapamiętać, zapisać, przypomnieć lub sprawdzić — użyj narzędzia.
Nigdy nie zmyślaj informacji które powinny być w bazie — zawsze użyj narzędzia.
Gdy dowiadujesz się czegoś ważnego o właścicielu — zapisz to przez fact_save.`

type AIMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{ id: string; name: string; arguments: unknown }>
  tool_call_id?: string
}

type AIResponse = {
  response?: string
  tool_calls?: Array<{ id: string; name: string; arguments: unknown }>
}

async function runAI(env: Env, messages: AIMessage[]): Promise<AIResponse> {
  const ai = env.AI as Ai
  return (await (ai.run as Function)(env.AI_MODEL, {
    messages,
    tools: tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
  })) as AIResponse
}

async function buildMessages(
  userText: string,
  chatId: number,
  env: Env
): Promise<AIMessage[]> {
  const [history, facts] = await Promise.all([
    getHistory(env.DB, chatId, 10),
    getAllFacts(env.DB),
  ])

  const systemPrompt = BASE_SYSTEM_PROMPT + facts

  return [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userText },
  ]
}

async function resolveToolCalls(
  first: AIResponse,
  messages: AIMessage[],
  chatId: number,
  env: Env
): Promise<string> {
  if (!first.tool_calls?.length) {
    return first.response ?? 'Nie rozumiem, spróbuj inaczej.'
  }

  const call = first.tool_calls[0]
  const result = await executeTool(call.name, call.arguments, env.DB, chatId, env)

  const second = await runAI(env, [
    ...messages,
    { role: 'assistant', content: null, tool_calls: first.tool_calls },
    { role: 'tool', content: JSON.stringify(result), tool_call_id: call.id },
  ])

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

export async function orchestrateStream(
  userText: string,
  chatId: number,
  env: Env
): Promise<{ stream: ReadableStream }> {
  await saveMessage(env.DB, chatId, 'user', userText)

  const messages = await buildMessages(userText, chatId, env)
  const first = await runAI(env, messages)
  const reply = await resolveToolCalls(first, messages, chatId, env)

  await saveMessage(env.DB, chatId, 'assistant', reply)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const words = reply.split(' ')
      for (const word of words) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: word + ' ' })}\n\n`))
        await new Promise((r) => setTimeout(r, 30))
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return { stream }
}
