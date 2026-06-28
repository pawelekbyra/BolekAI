import type { Env } from './env'
import { getHistory, saveMessage } from './memory'
import { tools, executeTool } from './tools'

const SYSTEM_PROMPT = `Jesteś AGENT BOLEK — osobisty asystent AI swojego właściciela.
Rozmawiasz wyłącznie po polsku. Jesteś konkretny, bezpośredni i pomocny.
Masz dostęp do narzędzi: możesz zapisywać zadania, notatki i przeszukiwać pamięć.
Gdy użytkownik chce coś zapamiętać, zapisać lub sprawdzić — użyj odpowiedniego narzędzia.
Nigdy nie zmyślaj informacji które powinny być w bazie — zawsze użyj narzędzia.`

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

export async function orchestrate(userText: string, chatId: number, env: Env): Promise<string> {
  await saveMessage(env.DB, chatId, 'user', userText)

  const history = await getHistory(env.DB, chatId, 10)

  const messages: AIMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userText },
  ]

  const ai = env.AI as Ai
  const first = await (ai.run as Function)(env.AI_MODEL, {
    messages,
    tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
  }) as AIResponse

  if (first.tool_calls?.length) {
    const call = first.tool_calls[0]
    const result = await executeTool(call.name, call.arguments, env.DB)

    const second = await (ai.run as Function)(env.AI_MODEL, {
      messages: [
        ...messages,
        { role: 'assistant', content: null, tool_calls: first.tool_calls },
        { role: 'tool', content: JSON.stringify(result), tool_call_id: call.id },
      ],
    }) as AIResponse

    const reply = second.response ?? 'Gotowe.'
    await saveMessage(env.DB, chatId, 'assistant', reply)
    return reply
  }

  const reply = first.response ?? 'Nie rozumiem, spróbuj inaczej.'
  await saveMessage(env.DB, chatId, 'assistant', reply)
  return reply
}
