import type { Env } from '../env'
import { CHARACTERS, listCharacters } from './characters'
import { send } from '../telegram'

async function askCharacter(env: Env, characterName: string, topic: string, context: string): Promise<string> {
  const character = CHARACTERS[characterName]
  if (!character) throw new Error(`Unknown character: ${characterName}`)

  const ai = env.AI as Ai
  const response = await (ai.run as Function)(env.AI_MODEL, {
    messages: [
      { role: 'system', content: character.systemPrompt },
      {
        role: 'user',
        content: context
          ? `Temat debaty: ${topic}\n\nCo powiedzieli już inni:\n${context}\n\nTwoja odpowiedź:`
          : `Temat debaty: ${topic}\n\nZacznij debatę — co o tym myślisz?`,
      },
    ],
  }) as { response?: string }

  return response.response ?? '...'
}

export async function runDebate(
  topic: string,
  chatId: number,
  env: Env,
  characters?: string[]
): Promise<void> {
  const participants = characters ?? listCharacters().map((c) => c.name)

  const debate = await env.DB
    .prepare('INSERT INTO debates (topic, status, chat_id) VALUES (?, ?, ?) RETURNING id')
    .bind(topic, 'running', chatId)
    .first<{ id: number }>()

  const debateId = debate?.id
  if (!debateId) throw new Error('Failed to create debate')

  await send(env.TELEGRAM_BOT_TOKEN, chatId,
    `🎭 *Debata rozpoczęta!*\n\nTemat: _${topic}_\n\nUczestnicy: ${participants.map(n => CHARACTERS[n]?.emoji + ' ' + n).join(', ')}`
  )

  let context = ''

  for (let i = 0; i < participants.length; i++) {
    const characterName = participants[i]
    const character = CHARACTERS[characterName]
    if (!character) continue

    await env.DB
      .prepare('UPDATE characters SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?')
      .bind('talking', characterName)
      .run()

    const content = await askCharacter(env, characterName, topic, context)

    await env.DB
      .prepare('INSERT INTO debate_turns (debate_id, character, content, turn_order) VALUES (?, ?, ?, ?)')
      .bind(debateId, characterName, content, i + 1)
      .run()

    await env.DB
      .prepare('INSERT INTO character_messages (from_char, message, topic) VALUES (?, ?, ?)')
      .bind(characterName, content, topic)
      .run()

    await env.DB
      .prepare('UPDATE characters SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?')
      .bind('idle', characterName)
      .run()

    context += `\n${character.emoji} ${characterName}: ${content}`

    await send(env.TELEGRAM_BOT_TOKEN, chatId,
      `${character.emoji} *${characterName}*\n\n${content}`
    )
  }

  await env.DB
    .prepare('UPDATE debates SET status = ? WHERE id = ?')
    .bind('done', debateId)
    .run()

  await send(env.TELEGRAM_BOT_TOKEN, chatId, `🎭 Debata zakończona.`)
}
