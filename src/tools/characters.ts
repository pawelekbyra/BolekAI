import type { ToolDefinition } from './index'
import type { Env } from '../env'
import { CHARACTERS, listCharacters } from '../agents/characters'
import { runDebate } from '../agents/debate'

export const characterTools: ToolDefinition[] = [
  {
    name: 'character_debate',
    description: 'Uruchom debatę między postaciami na podany temat — każda postać wypowiada się ze swojej perspektywy',
    parameters: {
      type: 'object',
      properties: {
        topic:      { type: 'string', description: 'Temat debaty' },
        characters: { type: 'string', description: 'Postacie oddzielone przecinkiem: Marek, Asia, Stary, Zofia (opcjonalnie — domyślnie wszystkie)' },
      },
      required: ['topic'],
    },
  },
  {
    name: 'character_ask',
    description: 'Zapytaj konkretną postać o coś — odpowie zgodnie ze swoją osobowością',
    parameters: {
      type: 'object',
      properties: {
        character: { type: 'string', description: 'Imię postaci: Marek | Asia | Stary | Zofia' },
        question:  { type: 'string', description: 'Pytanie lub temat do skomentowania' },
      },
      required: ['character', 'question'],
    },
  },
  {
    name: 'character_list',
    description: 'Wylistuj dostępne postacie i ich osobowości',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'character_history',
    description: 'Pokaż ostatnie wypowiedzi postaci',
    parameters: {
      type: 'object',
      properties: {
        character: { type: 'string', description: 'Imię postaci (opcjonalnie)' },
      },
    },
  },
]

type Args = { topic?: string; characters?: string; character?: string; question?: string }

export async function executeCharacterTool(
  name: string,
  args: unknown,
  env: Env,
  chatId: number
): Promise<unknown> {
  const a = args as Args

  switch (name) {
    case 'character_debate': {
      const participants = a.characters
        ? a.characters.split(',').map((s) => s.trim())
        : undefined

      env.AI && runDebate(a.topic!, chatId, env, participants).catch(console.error)
      return { ok: true, message: `Debata na temat "${a.topic}" rozpoczęta. Posłuchaj co mają do powiedzenia...` }
    }

    case 'character_ask': {
      const character = CHARACTERS[a.character!]
      if (!character) return { error: `Nieznana postać: ${a.character}. Dostępne: ${listCharacters().map(c => c.name).join(', ')}` }

      const ai = env.AI as Ai
      const response = await (ai.run as Function)(env.AI_MODEL, {
        messages: [
          { role: 'system', content: character.systemPrompt },
          { role: 'user', content: a.question! },
        ],
      }) as { response?: string }

      const content = response.response ?? '...'

      await env.DB
        .prepare('INSERT INTO character_messages (from_char, message, topic) VALUES (?, ?, ?)')
        .bind(a.character, content, a.question)
        .run()

      return { character: a.character, emoji: character.emoji, response: content }
    }

    case 'character_list': {
      return listCharacters().map((c) => ({
        name: c.name,
        emoji: c.emoji,
        personality: c.personality,
      }))
    }

    case 'character_history': {
      const query = a.character
        ? 'SELECT from_char, message, topic, created_at FROM character_messages WHERE from_char = ? ORDER BY created_at DESC LIMIT 10'
        : 'SELECT from_char, message, topic, created_at FROM character_messages ORDER BY created_at DESC LIMIT 20'

      const result = a.character
        ? await env.DB.prepare(query).bind(a.character).all()
        : await env.DB.prepare(query).all()

      return result.results
    }

    default:
      throw new Error(`Unknown character tool: ${name}`)
  }
}
